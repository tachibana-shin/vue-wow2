import "./animate.css"

var MutationObserver, Util, WeakMap, getComputedStyle, getComputedStyleRX, updateValue,
  indexOf = [].indexOf;

Util = class Util {
  extend(custom, defaults) {
    var key, value;
    for (key in defaults) {
      value = defaults[key];
      if (custom[key] == null) {
        custom[key] = value;
      }
    }
    return custom;
  }

  isMobile(agent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(agent);
  }

  createEvent(event, bubble = false, cancel = false, detail = null) {
    var customEvent;
    if (document.createEvent != null) {
      customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent(event, bubble, cancel, detail);
    } else if (document.createEventObject != null) {
      customEvent = document.createEventObject();
      customEvent.eventType = event;
    } else {
      customEvent.eventName = event; // IE DOM < 9
      // W3C DOM
    }
    return customEvent;
  }

  emitEvent(elem, event) {
    if (elem.dispatchEvent != null) {
      return elem.dispatchEvent(event);
    } else if (event in (elem != null)) {
      return elem[event]();
    } else if (`on${event}` in (elem != null)) {
      return elem[`on${event}`](); // W3C DOM
    }
  }

  addEvent(elem, event, fn) {
    if (elem.addEventListener != null) {
      return elem.addEventListener(event, fn, false);
    } else if (elem.attachEvent != null) {
      return elem.attachEvent(`on${event}`, fn); // fallback
    } else {
      return elem[event] = fn; // IE DOM
      // W3C DOM
    }
  }

  removeEvent(elem, event, fn) {
    if (elem.removeEventListener != null) {
      return elem.removeEventListener(event, fn, false);
    } else if (elem.detachEvent != null) {
      return elem.detachEvent(`on${event}`, fn); // fallback
    } else {
      return delete elem[event]; // IE DOM
      // W3C DOM
    }
  }

  innerHeight() {
    if ('innerHeight' in window) {
      return window.innerHeight;
    } else {
      return document.documentElement.clientHeight;
    }
  }

};

// Minimalistic WeakMap shim, just in case.
WeakMap = this.WeakMap || this.MozWeakMap || (WeakMap = class WeakMap {
  constructor() {
    this.keys = [];
    this.values = [];
  }

  get(key) {
    var i, item, j, len, ref;
    ref = this.keys;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      item = ref[i];
      if (item === key) {
        return this.values[i];
      }
    }
  }

  set(key, value) {
    var i, item, j, len, ref;
    ref = this.keys;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      item = ref[i];
      if (item === key) {
        this.values[i] = value;
        return;
      }
    }
    this.keys.push(key);
    return this.values.push(value);
  }

});

// Dummy MutationObserver, to avoid raising exceptions.
MutationObserver = this.MutationObserver || this.WebkitMutationObserver || this.MozMutationObserver || (MutationObserver = (function() {
  class MutationObserver {
    constructor() {
      if (typeof console !== "undefined" && console !== null) {
        console.warn('MutationObserver is not supported by your browser.');
      }
      if (typeof console !== "undefined" && console !== null) {
        console.warn('WOW.js cannot detect dom mutations, please call .sync() after loading new content.');
      }
    }

    observe() {}

  };

  MutationObserver.notSupported = true;

  return MutationObserver;

}).call(this));

// getComputedStyle shim, from http://stackoverflow.com/a/21797294
getComputedStyle = this.getComputedStyle || function(el, pseudo) {
  this.getPropertyValue = function(prop) {
    var ref;
    if (prop === 'float') {
      prop = 'styleFloat';
    }
    if (getComputedStyleRX.test(prop)) {
      prop.replace(getComputedStyleRX, function(_, _char) {
        return _char.toUpperCase();
      });
    }
    return ((ref = el.currentStyle) != null ? ref[prop] : void 0) || null;
  };
  return this;
};

getComputedStyleRX = /(\-([a-z]){1})/g;

updateValue = function(el, arg, value) {
  var delay, duration, iteration, name, offset;
  name = arg;
  if (indexOf.call(el, "__vueWOW") >= 0) {
    el.className = el.className.replace(el.__vueWOW.name, "").trim();
  }
  el.className = `${el.className} ${arg}`.trim();
  if (value !== null && typeof value === "object") {
    ({ duration, name, delay, iteration, offset } = value);
  } else {
    duration = value;
  }
  this.elements.push(el);
  return el.__vueWOW = {
    duration: duration,
    name: name,
    delay: delay,
    iteration: iteration,
    offset: offset
  };
};

var VueWOW = (function() {
  class VueWOW {
    install(Vue, options = {}) {
      this.config = this.util().extend(options, VueWOW.defaults);
      Vue.directive("wow", {
        bind: function(el, { arg, value }) {
          updateValue(el(arg(value)));
          return this.doSync(el);
        },
        update: function(el, { arg, value }) {
          updateValue(el(arg(value)));
          return this.doSync(el);
        },
        unbind: function(el) {
          return this.elements = this.elements.filter(item(() => {
            return item !== el;
          }));
        }
      });
      return this.init();
    }

    constructor(options = {}) {
      this.start = this.start.bind(this);
      this.resetAnimation = this.resetAnimation.bind(this);
      // fast window.scroll callback
      this.scrollHandler = this.scrollHandler.bind(this);
      this.scrollCallback = this.scrollCallback.bind(this);
      this.scrolled = true;
      if (options.scrollContainer != null) {
        this.config.scrollContainer = document.querySelector(options.scrollContainer);
      }
      // Map of elements to animation names:
      this.animationNameCache = new WeakMap();
      this.wowEvent = this.util().createEvent("vue-wow");
    }

    init() {
      var ref;
      this.element = window.document.documentElement;
      if ((ref = document.readyState) === "interactive" || ref === "complete") {
        this.start();
      } else {
        this.util().addEvent(document, 'DOMContentLoaded', this.start);
      }
      return this.finished = [];
    }

    start() {
      var box, j, len, ref;
      this.stopped = false;
      this.boxes = (function() {
        var j, len, ref, results;
        ref = this.elements;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          box = ref[j];
          results.push(box);
        }
        return results;
      }).call(this);
      this.all = (function() {
        var j, len, ref, results;
        ref = this.boxes;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          box = ref[j];
          results.push(box);
        }
        return results;
      }).call(this);
      if (this.boxes.length) {
        if (this.disabled()) {
          this.resetStyle();
        } else {
          ref = this.boxes;
          for (j = 0, len = ref.length; j < len; j++) {
            box = ref[j];
            this.applyStyle(box, true);
          }
        }
      }
      if (!this.disabled()) {
        this.util().addEvent(this.config.scrollContainer || window, 'scroll', this.scrollHandler);
        this.util().addEvent(window, 'resize', this.scrollHandler);
        this.interval = setInterval(this.scrollCallback, 50);
      }
      if (this.config.live) {
        return new MutationObserver((records) => {
          var k, len1, node, record, results;
          results = [];
          for (k = 0, len1 = records.length; k < len1; k++) {
            record = records[k];
            results.push((function() {
              var l, len2, ref1, results1;
              ref1 = record.addedNodes || [];
              results1 = [];
              for (l = 0, len2 = ref1.length; l < len2; l++) {
                node = ref1[l];
                results1.push(this.doSync(node));
              }
              return results1;
            }).call(this));
          }
          return results;
        }).observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }

    // unbind the scroll event
    stop() {
      this.stopped = true;
      this.util().removeEvent(this.config.scrollContainer || window, 'scroll', this.scrollHandler);
      this.util().removeEvent(window, 'resize', this.scrollHandler);
      if (this.interval != null) {
        return clearInterval(this.interval);
      }
    }

    sync(element) {
      if (MutationObserver.notSupported) {
        return this.doSync(this.element);
      }
    }

    doSync(element) {
      var box, j, len, ref, results;
      if (element == null) {
        element = this.element;
      }
      if (element.nodeType !== 1) {
        return;
      }
      element = element.parentNode || element;
      ref = this.elements;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        box = ref[j];
        if (indexOf.call(this.all, box) < 0) {
          this.boxes.push(box);
          this.all.push(box);
          if (this.stopped || this.disabled()) {
            this.resetStyle();
          } else {
            this.applyStyle(box, true);
          }
          results.push(this.scrolled = true);
        } else {
          results.push(void 0);
        }
      }
      return results;
    }

    // show box element
    show(box) {
      this.applyStyle(box);
      box.className = `${box.className} ${this.config.animateClass}`;
      this.util().emitEvent(box, this.wowEvent);
      this.util().addEvent(box, 'animationend', this.resetAnimation);
      this.util().addEvent(box, 'oanimationend', this.resetAnimation);
      this.util().addEvent(box, 'webkitAnimationEnd', this.resetAnimation);
      this.util().addEvent(box, 'MSAnimationEnd', this.resetAnimation);
      return box;
    }

    applyStyle(box, hidden) {
      var delay, duration, iteration;
      ({ duration, delay, iteration } = box.__vueWOW);
      return this.animate(() => {
        return this.customStyle(box, hidden, duration, delay, iteration);
      });
    }

    resetStyle() {
      var box, j, len, ref, results;
      ref = this.boxes;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        box = ref[j];
        results.push(box.style.visibility = 'visible');
      }
      return results;
    }

    resetAnimation(event) {
      var target;
      if (event.type.toLowerCase().indexOf('animationend') >= 0) {
        target = event.target || event.srcElement;
        return target.className = target.className.replace(this.config.animateClass, '').trim();
      }
    }

    customStyle(box, hidden, duration, delay, iteration) {
      if (hidden) {
        this.cacheAnimationName(box);
      }
      box.style.visibility = hidden ? 'hidden' : 'visible';
      if (duration) {
        this.vendorSet(box.style, {
          animationDuration: duration
        });
      }
      if (delay) {
        this.vendorSet(box.style, {
          animationDelay: delay
        });
      }
      if (iteration) {
        this.vendorSet(box.style, {
          animationIterationCount: iteration
        });
      }
      this.vendorSet(box.style, {
        animationName: hidden ? 'none' : this.cachedAnimationName(box)
      });
      return box;
    }

    vendorSet(elem, properties) {
      var name, results, value, vendor;
      results = [];
      for (name in properties) {
        value = properties[name];
        elem[`${name}`] = value;
        results.push((function() {
          var j, len, ref, results1;
          ref = this.vendors;
          results1 = [];
          for (j = 0, len = ref.length; j < len; j++) {
            vendor = ref[j];
            results1.push(elem[`${vendor}${name.charAt(0).toUpperCase()}${name.substr(1)}`] = value);
          }
          return results1;
        }).call(this));
      }
      return results;
    }

    vendorCSS(elem, property) {
      var j, len, ref, result, style, vendor;
      style = getComputedStyle(elem);
      result = style.getPropertyCSSValue(property);
      ref = this.vendors;
      for (j = 0, len = ref.length; j < len; j++) {
        vendor = ref[j];
        result = result || style.getPropertyCSSValue(`-${vendor}-${property}`);
      }
      return result;
    }

    animationName(box) {
      var animationName;
      try {
        animationName = this.vendorCSS(box, 'animation-name').cssText; // Opera, fall back to plain property value
      } catch (error) {
        animationName = getComputedStyle(box).getPropertyValue('animation-name');
      }
      if (animationName === 'none') {
        return ''; // SVG/Firefox, unable to get animation name?
      } else {
        return animationName;
      }
    }

    cacheAnimationName(box) {
      // https://bugzilla.mozilla.org/show_bug.cgi?id=921834
      // box.dataset is not supported for SVG elements in Firefox
      return this.animationNameCache.set(box, this.animationName(box));
    }

    cachedAnimationName(box) {
      return this.animationNameCache.get(box);
    }

    scrollHandler() {
      return this.scrolled = true;
    }

    scrollCallback() {
      var box;
      if (this.scrolled) {
        this.scrolled = false;
        this.boxes = (function() {
          var j, len, ref, results;
          ref = this.boxes;
          results = [];
          for (j = 0, len = ref.length; j < len; j++) {
            box = ref[j];
            if (!(box)) {
              continue;
            }
            if (this.isVisible(box)) {
              this.show(box);
              continue;
            }
            results.push(box);
          }
          return results;
        }).call(this);
        if (!(this.boxes.length || this.config.live)) {
          return this.stop();
        }
      }
    }

    // Calculate element offset top
    offsetTop(element) {
      var top;
      while (element.offsetTop === void 0) {
        // SVG elements don't have an offsetTop in Firefox.
        // This will use their nearest parent that has an offsetTop.
        // Also, using ('offsetTop' of element) causes an exception in Firefox.
        element = element.parentNode;
      }
      top = element.offsetTop;
      while (element = element.offsetParent) {
        top += element.offsetTop;
      }
      return top;
    }

    // check if box is visible
    isVisible(box) {
      var bottom, offset, top, viewBottom, viewTop;
      offset = box.__vueWOW.offset || this.config.offset;
      viewTop = (this.config.scrollContainer && this.config.scrollContainer.scrollTop) || window.pageYOffset;
      viewBottom = viewTop + Math.min(this.element.clientHeight, this.util().innerHeight()) - offset;
      top = this.offsetTop(box);
      bottom = top + box.clientHeight;
      return top <= viewBottom && bottom >= viewTop;
    }

    util() {
      return this._util != null ? this._util : this._util = new Util();
    }

    disabled() {
      return !this.config.mobile && this.util().isMobile(navigator.userAgent);
    }

  };

  VueWOW.defaults = {
    animateClass: 'animated',
    offset: 0,
    mobile: true,
    live: true,
    scrollContainer: null
  };

  VueWOW.prototype.config = {};

  VueWOW.prototype.elements = [];

  VueWOW.prototype.animate = (function() {
    if ('requestAnimationFrame' in window) {
      return function(callback) {
        return window.requestAnimationFrame(callback);
      };
    } else {
      return function(callback) {
        return callback();
      };
    }
  })();

  VueWOW.prototype.vendors = ["moz", "webkit"];

  return VueWOW;

}).call(this);

export default new VueWOW()