var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/scheduler/cjs/scheduler.production.js
var require_scheduler_production = __commonJS({
  "node_modules/scheduler/cjs/scheduler.production.js"(exports) {
    "use strict";
    function push(heap, node) {
      var index = heap.length;
      heap.push(node);
      a: for (; 0 < index; ) {
        var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
        if (0 < compare(parent, node))
          heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
        else break a;
      }
    }
    function peek2(heap) {
      return 0 === heap.length ? null : heap[0];
    }
    function pop(heap) {
      if (0 === heap.length) return null;
      var first = heap[0], last = heap.pop();
      if (last !== first) {
        heap[0] = last;
        a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
          var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
          if (0 > compare(left, last))
            rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
          else if (rightIndex < length && 0 > compare(right, last))
            heap[index] = right, heap[rightIndex] = last, index = rightIndex;
          else break a;
        }
      }
      return first;
    }
    function compare(a, b) {
      var diff = a.sortIndex - b.sortIndex;
      return 0 !== diff ? diff : a.id - b.id;
    }
    exports.unstable_now = void 0;
    if ("object" === typeof performance && "function" === typeof performance.now) {
      localPerformance = performance;
      exports.unstable_now = function() {
        return localPerformance.now();
      };
    } else {
      localDate = Date, initialTime = localDate.now();
      exports.unstable_now = function() {
        return localDate.now() - initialTime;
      };
    }
    var localPerformance;
    var localDate;
    var initialTime;
    var taskQueue = [];
    var timerQueue = [];
    var taskIdCounter = 1;
    var currentTask = null;
    var currentPriorityLevel = 3;
    var isPerformingWork = false;
    var isHostCallbackScheduled = false;
    var isHostTimeoutScheduled = false;
    var needsPaint = false;
    var localSetTimeout = "function" === typeof setTimeout ? setTimeout : null;
    var localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null;
    var localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
    function advanceTimers(currentTime) {
      for (var timer = peek2(timerQueue); null !== timer; ) {
        if (null === timer.callback) pop(timerQueue);
        else if (timer.startTime <= currentTime)
          pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
        else break;
        timer = peek2(timerQueue);
      }
    }
    function handleTimeout(currentTime) {
      isHostTimeoutScheduled = false;
      advanceTimers(currentTime);
      if (!isHostCallbackScheduled)
        if (null !== peek2(taskQueue))
          isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
        else {
          var firstTimer = peek2(timerQueue);
          null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
        }
    }
    var isMessageLoopRunning = false;
    var taskTimeoutID = -1;
    var frameInterval = 5;
    var startTime = -1;
    function shouldYieldToHost() {
      return needsPaint ? true : exports.unstable_now() - startTime < frameInterval ? false : true;
    }
    function performWorkUntilDeadline() {
      needsPaint = false;
      if (isMessageLoopRunning) {
        var currentTime = exports.unstable_now();
        startTime = currentTime;
        var hasMoreWork = true;
        try {
          a: {
            isHostCallbackScheduled = false;
            isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
            isPerformingWork = true;
            var previousPriorityLevel = currentPriorityLevel;
            try {
              b: {
                advanceTimers(currentTime);
                for (currentTask = peek2(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                  var callback = currentTask.callback;
                  if ("function" === typeof callback) {
                    currentTask.callback = null;
                    currentPriorityLevel = currentTask.priorityLevel;
                    var continuationCallback = callback(
                      currentTask.expirationTime <= currentTime
                    );
                    currentTime = exports.unstable_now();
                    if ("function" === typeof continuationCallback) {
                      currentTask.callback = continuationCallback;
                      advanceTimers(currentTime);
                      hasMoreWork = true;
                      break b;
                    }
                    currentTask === peek2(taskQueue) && pop(taskQueue);
                    advanceTimers(currentTime);
                  } else pop(taskQueue);
                  currentTask = peek2(taskQueue);
                }
                if (null !== currentTask) hasMoreWork = true;
                else {
                  var firstTimer = peek2(timerQueue);
                  null !== firstTimer && requestHostTimeout(
                    handleTimeout,
                    firstTimer.startTime - currentTime
                  );
                  hasMoreWork = false;
                }
              }
              break a;
            } finally {
              currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
            }
            hasMoreWork = void 0;
          }
        } finally {
          hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
        }
      }
    }
    var schedulePerformWorkUntilDeadline;
    if ("function" === typeof localSetImmediate)
      schedulePerformWorkUntilDeadline = function() {
        localSetImmediate(performWorkUntilDeadline);
      };
    else if ("undefined" !== typeof MessageChannel) {
      channel = new MessageChannel(), port = channel.port2;
      channel.port1.onmessage = performWorkUntilDeadline;
      schedulePerformWorkUntilDeadline = function() {
        port.postMessage(null);
      };
    } else
      schedulePerformWorkUntilDeadline = function() {
        localSetTimeout(performWorkUntilDeadline, 0);
      };
    var channel;
    var port;
    function requestHostTimeout(callback, ms) {
      taskTimeoutID = localSetTimeout(function() {
        callback(exports.unstable_now());
      }, ms);
    }
    exports.unstable_IdlePriority = 5;
    exports.unstable_ImmediatePriority = 1;
    exports.unstable_LowPriority = 4;
    exports.unstable_NormalPriority = 3;
    exports.unstable_Profiling = null;
    exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function(task) {
      task.callback = null;
    };
    exports.unstable_forceFrameRate = function(fps) {
      0 > fps || 125 < fps ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
    };
    exports.unstable_getCurrentPriorityLevel = function() {
      return currentPriorityLevel;
    };
    exports.unstable_next = function(eventHandler) {
      switch (currentPriorityLevel) {
        case 1:
        case 2:
        case 3:
          var priorityLevel = 3;
          break;
        default:
          priorityLevel = currentPriorityLevel;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports.unstable_requestPaint = function() {
      needsPaint = true;
    };
    exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
      switch (priorityLevel) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          priorityLevel = 3;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
      var currentTime = exports.unstable_now();
      "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
      switch (priorityLevel) {
        case 1:
          var timeout = -1;
          break;
        case 2:
          timeout = 250;
          break;
        case 5:
          timeout = 1073741823;
          break;
        case 4:
          timeout = 1e4;
          break;
        default:
          timeout = 5e3;
      }
      timeout = options + timeout;
      priorityLevel = {
        id: taskIdCounter++,
        callback,
        priorityLevel,
        startTime: options,
        expirationTime: timeout,
        sortIndex: -1
      };
      options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek2(taskQueue) && priorityLevel === peek2(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
      return priorityLevel;
    };
    exports.unstable_shouldYield = shouldYieldToHost;
    exports.unstable_wrapCallback = function(callback) {
      var parentPriorityLevel = currentPriorityLevel;
      return function() {
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = parentPriorityLevel;
        try {
          return callback.apply(this, arguments);
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
    };
  }
});

// node_modules/scheduler/index.js
var require_scheduler = __commonJS({
  "node_modules/scheduler/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_scheduler_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = Symbol.for("react.memo");
    var REACT_LAZY_TYPE = Symbol.for("react.lazy");
    var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    function noop() {
    }
    var ReactSharedInternals = { H: null, A: null, T: null, S: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, props) {
      var refProp = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== refProp ? refProp : null,
        props
      };
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(oldElement.type, newKey, oldElement.props);
    }
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
          return c;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0; i < children.length; i++)
          nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i = getIteratorFn(children), "function" === typeof i)
        for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result;
        ctor = ctor();
        ctor.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject;
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error;
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = ctor);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    var Children = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      },
      count: function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = Children;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i = 0; i < propName; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create2, deps) {
      return ReactSharedInternals.H.useEffect(create2, deps);
    };
    exports.useEffectEvent = function(callback) {
      return ReactSharedInternals.H.useEffectEvent(callback);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create2, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create2, deps);
    };
    exports.useInsertionEffect = function(create2, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create2, deps);
    };
    exports.useLayoutEffect = function(create2, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create2, deps);
    };
    exports.useMemo = function(create2, deps) {
      return ReactSharedInternals.H.useMemo(create2, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.2.7";
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react-dom/cjs/react-dom.production.js
var require_react_dom_production = __commonJS({
  "node_modules/react-dom/cjs/react-dom.production.js"(exports) {
    "use strict";
    var React = require_react();
    function formatProdErrorMessage(code) {
      var url = "https://react.dev/errors/" + code;
      if (1 < arguments.length) {
        url += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var i = 2; i < arguments.length; i++)
          url += "&args[]=" + encodeURIComponent(arguments[i]);
      }
      return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function noop() {
    }
    var Internals = {
      d: {
        f: noop,
        r: function() {
          throw Error(formatProdErrorMessage(522));
        },
        D: noop,
        C: noop,
        L: noop,
        m: noop,
        X: noop,
        S: noop,
        M: noop
      },
      p: 0,
      findDOMNode: null
    };
    var REACT_PORTAL_TYPE = Symbol.for("react.portal");
    function createPortal$1(children, containerInfo, implementation) {
      var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
      return {
        $$typeof: REACT_PORTAL_TYPE,
        key: null == key ? null : "" + key,
        children,
        containerInfo,
        implementation
      };
    }
    var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function getCrossOriginStringAs(as, input) {
      if ("font" === as) return "";
      if ("string" === typeof input)
        return "use-credentials" === input ? input : "";
    }
    exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
    exports.createPortal = function(children, container) {
      var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
      if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
        throw Error(formatProdErrorMessage(299));
      return createPortal$1(children, container, null, key);
    };
    exports.flushSync = function(fn) {
      var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
      try {
        if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
      } finally {
        ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
      }
    };
    exports.preconnect = function(href, options) {
      "string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
    };
    exports.prefetchDNS = function(href) {
      "string" === typeof href && Internals.d.D(href);
    };
    exports.preinit = function(href, options) {
      if ("string" === typeof href && options && "string" === typeof options.as) {
        var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
        "style" === as ? Internals.d.S(
          href,
          "string" === typeof options.precedence ? options.precedence : void 0,
          {
            crossOrigin,
            integrity,
            fetchPriority
          }
        ) : "script" === as && Internals.d.X(href, {
          crossOrigin,
          integrity,
          fetchPriority,
          nonce: "string" === typeof options.nonce ? options.nonce : void 0
        });
      }
    };
    exports.preinitModule = function(href, options) {
      if ("string" === typeof href)
        if ("object" === typeof options && null !== options) {
          if (null == options.as || "script" === options.as) {
            var crossOrigin = getCrossOriginStringAs(
              options.as,
              options.crossOrigin
            );
            Internals.d.M(href, {
              crossOrigin,
              integrity: "string" === typeof options.integrity ? options.integrity : void 0,
              nonce: "string" === typeof options.nonce ? options.nonce : void 0
            });
          }
        } else null == options && Internals.d.M(href);
    };
    exports.preload = function(href, options) {
      if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
        var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
        Internals.d.L(href, as, {
          crossOrigin,
          integrity: "string" === typeof options.integrity ? options.integrity : void 0,
          nonce: "string" === typeof options.nonce ? options.nonce : void 0,
          type: "string" === typeof options.type ? options.type : void 0,
          fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
          referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
          imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
          imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
          media: "string" === typeof options.media ? options.media : void 0
        });
      }
    };
    exports.preloadModule = function(href, options) {
      if ("string" === typeof href)
        if (options) {
          var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
          Internals.d.m(href, {
            as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0
          });
        } else Internals.d.m(href);
    };
    exports.requestFormReset = function(form) {
      Internals.d.r(form);
    };
    exports.unstable_batchedUpdates = function(fn, a) {
      return fn(a);
    };
    exports.useFormState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useFormState(action, initialState, permalink);
    };
    exports.useFormStatus = function() {
      return ReactSharedInternals.H.useHostTransitionStatus();
    };
    exports.version = "19.2.7";
  }
});

// node_modules/react-dom/index.js
var require_react_dom = __commonJS({
  "node_modules/react-dom/index.js"(exports, module) {
    "use strict";
    function checkDCE() {
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
        return;
      }
      if (false) {
        throw new Error("^_^");
      }
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
      } catch (err) {
        console.error(err);
      }
    }
    if (true) {
      checkDCE();
      module.exports = require_react_dom_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react-dom/cjs/react-dom-client.production.js
var require_react_dom_client_production = __commonJS({
  "node_modules/react-dom/cjs/react-dom-client.production.js"(exports) {
    "use strict";
    var Scheduler = require_scheduler();
    var React = require_react();
    var ReactDOM = require_react_dom();
    function formatProdErrorMessage(code) {
      var url = "https://react.dev/errors/" + code;
      if (1 < arguments.length) {
        url += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var i = 2; i < arguments.length; i++)
          url += "&args[]=" + encodeURIComponent(arguments[i]);
      }
      return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function isValidContainer(node) {
      return !(!node || 1 !== node.nodeType && 9 !== node.nodeType && 11 !== node.nodeType);
    }
    function getNearestMountedFiber(fiber) {
      var node = fiber, nearestMounted = fiber;
      if (fiber.alternate) for (; node.return; ) node = node.return;
      else {
        fiber = node;
        do
          node = fiber, 0 !== (node.flags & 4098) && (nearestMounted = node.return), fiber = node.return;
        while (fiber);
      }
      return 3 === node.tag ? nearestMounted : null;
    }
    function getSuspenseInstanceFromFiber(fiber) {
      if (13 === fiber.tag) {
        var suspenseState = fiber.memoizedState;
        null === suspenseState && (fiber = fiber.alternate, null !== fiber && (suspenseState = fiber.memoizedState));
        if (null !== suspenseState) return suspenseState.dehydrated;
      }
      return null;
    }
    function getActivityInstanceFromFiber(fiber) {
      if (31 === fiber.tag) {
        var activityState = fiber.memoizedState;
        null === activityState && (fiber = fiber.alternate, null !== fiber && (activityState = fiber.memoizedState));
        if (null !== activityState) return activityState.dehydrated;
      }
      return null;
    }
    function assertIsMounted(fiber) {
      if (getNearestMountedFiber(fiber) !== fiber)
        throw Error(formatProdErrorMessage(188));
    }
    function findCurrentFiberUsingSlowPath(fiber) {
      var alternate = fiber.alternate;
      if (!alternate) {
        alternate = getNearestMountedFiber(fiber);
        if (null === alternate) throw Error(formatProdErrorMessage(188));
        return alternate !== fiber ? null : fiber;
      }
      for (var a = fiber, b = alternate; ; ) {
        var parentA = a.return;
        if (null === parentA) break;
        var parentB = parentA.alternate;
        if (null === parentB) {
          b = parentA.return;
          if (null !== b) {
            a = b;
            continue;
          }
          break;
        }
        if (parentA.child === parentB.child) {
          for (parentB = parentA.child; parentB; ) {
            if (parentB === a) return assertIsMounted(parentA), fiber;
            if (parentB === b) return assertIsMounted(parentA), alternate;
            parentB = parentB.sibling;
          }
          throw Error(formatProdErrorMessage(188));
        }
        if (a.return !== b.return) a = parentA, b = parentB;
        else {
          for (var didFindChild = false, child$0 = parentA.child; child$0; ) {
            if (child$0 === a) {
              didFindChild = true;
              a = parentA;
              b = parentB;
              break;
            }
            if (child$0 === b) {
              didFindChild = true;
              b = parentA;
              a = parentB;
              break;
            }
            child$0 = child$0.sibling;
          }
          if (!didFindChild) {
            for (child$0 = parentB.child; child$0; ) {
              if (child$0 === a) {
                didFindChild = true;
                a = parentB;
                b = parentA;
                break;
              }
              if (child$0 === b) {
                didFindChild = true;
                b = parentB;
                a = parentA;
                break;
              }
              child$0 = child$0.sibling;
            }
            if (!didFindChild) throw Error(formatProdErrorMessage(189));
          }
        }
        if (a.alternate !== b) throw Error(formatProdErrorMessage(190));
      }
      if (3 !== a.tag) throw Error(formatProdErrorMessage(188));
      return a.stateNode.current === a ? fiber : alternate;
    }
    function findCurrentHostFiberImpl(node) {
      var tag = node.tag;
      if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return node;
      for (node = node.child; null !== node; ) {
        tag = findCurrentHostFiberImpl(node);
        if (null !== tag) return tag;
        node = node.sibling;
      }
      return null;
    }
    var assign = Object.assign;
    var REACT_LEGACY_ELEMENT_TYPE = Symbol.for("react.element");
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
    var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
    var REACT_MEMO_TYPE = Symbol.for("react.memo");
    var REACT_LAZY_TYPE = Symbol.for("react.lazy");
    Symbol.for("react.scope");
    var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
    Symbol.for("react.legacy_hidden");
    Symbol.for("react.tracing_marker");
    var REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel");
    Symbol.for("react.view_transition");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
    function getComponentNameFromType(type) {
      if (null == type) return null;
      if ("function" === typeof type)
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if ("string" === typeof type) return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
      }
      if ("object" === typeof type)
        switch (type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {
            }
        }
      return null;
    }
    var isArrayImpl = Array.isArray;
    var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    var ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    var sharedNotPendingObject = {
      pending: false,
      data: null,
      method: null,
      action: null
    };
    var valueStack = [];
    var index = -1;
    function createCursor(defaultValue) {
      return { current: defaultValue };
    }
    function pop(cursor) {
      0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
    }
    function push(cursor, value) {
      index++;
      valueStack[index] = cursor.current;
      cursor.current = value;
    }
    var contextStackCursor = createCursor(null);
    var contextFiberStackCursor = createCursor(null);
    var rootInstanceStackCursor = createCursor(null);
    var hostTransitionProviderCursor = createCursor(null);
    function pushHostContainer(fiber, nextRootInstance) {
      push(rootInstanceStackCursor, nextRootInstance);
      push(contextFiberStackCursor, fiber);
      push(contextStackCursor, null);
      switch (nextRootInstance.nodeType) {
        case 9:
        case 11:
          fiber = (fiber = nextRootInstance.documentElement) ? (fiber = fiber.namespaceURI) ? getOwnHostContext(fiber) : 0 : 0;
          break;
        default:
          if (fiber = nextRootInstance.tagName, nextRootInstance = nextRootInstance.namespaceURI)
            nextRootInstance = getOwnHostContext(nextRootInstance), fiber = getChildHostContextProd(nextRootInstance, fiber);
          else
            switch (fiber) {
              case "svg":
                fiber = 1;
                break;
              case "math":
                fiber = 2;
                break;
              default:
                fiber = 0;
            }
      }
      pop(contextStackCursor);
      push(contextStackCursor, fiber);
    }
    function popHostContainer() {
      pop(contextStackCursor);
      pop(contextFiberStackCursor);
      pop(rootInstanceStackCursor);
    }
    function pushHostContext(fiber) {
      null !== fiber.memoizedState && push(hostTransitionProviderCursor, fiber);
      var context = contextStackCursor.current;
      var JSCompiler_inline_result = getChildHostContextProd(context, fiber.type);
      context !== JSCompiler_inline_result && (push(contextFiberStackCursor, fiber), push(contextStackCursor, JSCompiler_inline_result));
    }
    function popHostContext(fiber) {
      contextFiberStackCursor.current === fiber && (pop(contextStackCursor), pop(contextFiberStackCursor));
      hostTransitionProviderCursor.current === fiber && (pop(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
    }
    var prefix;
    var suffix;
    function describeBuiltInComponentFrame(name) {
      if (void 0 === prefix)
        try {
          throw Error();
        } catch (x) {
          var match = x.stack.trim().match(/\n( *(at )?)/);
          prefix = match && match[1] || "";
          suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
        }
      return "\n" + prefix + name + suffix;
    }
    var reentry = false;
    function describeNativeComponentFrame(fn, construct) {
      if (!fn || reentry) return "";
      reentry = true;
      var previousPrepareStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        var RunInRootFrame = {
          DetermineComponentFrameRoot: function() {
            try {
              if (construct) {
                var Fake = function() {
                  throw Error();
                };
                Object.defineProperty(Fake.prototype, "props", {
                  set: function() {
                    throw Error();
                  }
                });
                if ("object" === typeof Reflect && Reflect.construct) {
                  try {
                    Reflect.construct(Fake, []);
                  } catch (x) {
                    var control = x;
                  }
                  Reflect.construct(fn, [], Fake);
                } else {
                  try {
                    Fake.call();
                  } catch (x$1) {
                    control = x$1;
                  }
                  fn.call(Fake.prototype);
                }
              } else {
                try {
                  throw Error();
                } catch (x$2) {
                  control = x$2;
                }
                (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {
                });
              }
            } catch (sample) {
              if (sample && control && "string" === typeof sample.stack)
                return [sample.stack, control.stack];
            }
            return [null, null];
          }
        };
        RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
        var namePropDescriptor = Object.getOwnPropertyDescriptor(
          RunInRootFrame.DetermineComponentFrameRoot,
          "name"
        );
        namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(
          RunInRootFrame.DetermineComponentFrameRoot,
          "name",
          { value: "DetermineComponentFrameRoot" }
        );
        var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
        if (sampleStack && controlStack) {
          var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
          for (namePropDescriptor = RunInRootFrame = 0; RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
            RunInRootFrame++;
          for (; namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes(
            "DetermineComponentFrameRoot"
          ); )
            namePropDescriptor++;
          if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
            for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1; 1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
              namePropDescriptor--;
          for (; 1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
            if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
              if (1 !== RunInRootFrame || 1 !== namePropDescriptor) {
                do
                  if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                    var frame = "\n" + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                    fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                    return frame;
                  }
                while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
              }
              break;
            }
        }
      } finally {
        reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
      }
      return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
    }
    function describeFiber(fiber, childFiber) {
      switch (fiber.tag) {
        case 26:
        case 27:
        case 5:
          return describeBuiltInComponentFrame(fiber.type);
        case 16:
          return describeBuiltInComponentFrame("Lazy");
        case 13:
          return fiber.child !== childFiber && null !== childFiber ? describeBuiltInComponentFrame("Suspense Fallback") : describeBuiltInComponentFrame("Suspense");
        case 19:
          return describeBuiltInComponentFrame("SuspenseList");
        case 0:
        case 15:
          return describeNativeComponentFrame(fiber.type, false);
        case 11:
          return describeNativeComponentFrame(fiber.type.render, false);
        case 1:
          return describeNativeComponentFrame(fiber.type, true);
        case 31:
          return describeBuiltInComponentFrame("Activity");
        default:
          return "";
      }
    }
    function getStackByFiberInDevAndProd(workInProgress2) {
      try {
        var info = "", previous = null;
        do
          info += describeFiber(workInProgress2, previous), previous = workInProgress2, workInProgress2 = workInProgress2.return;
        while (workInProgress2);
        return info;
      } catch (x) {
        return "\nError generating stack: " + x.message + "\n" + x.stack;
      }
    }
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var scheduleCallback$3 = Scheduler.unstable_scheduleCallback;
    var cancelCallback$1 = Scheduler.unstable_cancelCallback;
    var shouldYield = Scheduler.unstable_shouldYield;
    var requestPaint = Scheduler.unstable_requestPaint;
    var now = Scheduler.unstable_now;
    var getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
    var ImmediatePriority = Scheduler.unstable_ImmediatePriority;
    var UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
    var NormalPriority$1 = Scheduler.unstable_NormalPriority;
    var LowPriority = Scheduler.unstable_LowPriority;
    var IdlePriority = Scheduler.unstable_IdlePriority;
    var log$1 = Scheduler.log;
    var unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue;
    var rendererID = null;
    var injectedHook = null;
    function setIsStrictModeForDevtools(newIsStrictMode) {
      "function" === typeof log$1 && unstable_setDisableYieldValue(newIsStrictMode);
      if (injectedHook && "function" === typeof injectedHook.setStrictMode)
        try {
          injectedHook.setStrictMode(rendererID, newIsStrictMode);
        } catch (err) {
        }
    }
    var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
    var log = Math.log;
    var LN2 = Math.LN2;
    function clz32Fallback(x) {
      x >>>= 0;
      return 0 === x ? 32 : 31 - (log(x) / LN2 | 0) | 0;
    }
    var nextTransitionUpdateLane = 256;
    var nextTransitionDeferredLane = 262144;
    var nextRetryLane = 4194304;
    function getHighestPriorityLanes(lanes) {
      var pendingSyncLanes = lanes & 42;
      if (0 !== pendingSyncLanes) return pendingSyncLanes;
      switch (lanes & -lanes) {
        case 1:
          return 1;
        case 2:
          return 2;
        case 4:
          return 4;
        case 8:
          return 8;
        case 16:
          return 16;
        case 32:
          return 32;
        case 64:
          return 64;
        case 128:
          return 128;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
          return lanes & 261888;
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return lanes & 3932160;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return lanes & 62914560;
        case 67108864:
          return 67108864;
        case 134217728:
          return 134217728;
        case 268435456:
          return 268435456;
        case 536870912:
          return 536870912;
        case 1073741824:
          return 0;
        default:
          return lanes;
      }
    }
    function getNextLanes(root2, wipLanes, rootHasPendingCommit) {
      var pendingLanes = root2.pendingLanes;
      if (0 === pendingLanes) return 0;
      var nextLanes = 0, suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes;
      root2 = root2.warmLanes;
      var nonIdlePendingLanes = pendingLanes & 134217727;
      0 !== nonIdlePendingLanes ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, 0 !== pendingLanes ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = nonIdlePendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, 0 !== nonIdlePendingLanes ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = pendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))));
      return 0 === nextLanes ? 0 : 0 !== wipLanes && wipLanes !== nextLanes && 0 === (wipLanes & suspendedLanes) && (suspendedLanes = nextLanes & -nextLanes, rootHasPendingCommit = wipLanes & -wipLanes, suspendedLanes >= rootHasPendingCommit || 32 === suspendedLanes && 0 !== (rootHasPendingCommit & 4194048)) ? wipLanes : nextLanes;
    }
    function checkIfRootIsPrerendering(root2, renderLanes2) {
      return 0 === (root2.pendingLanes & ~(root2.suspendedLanes & ~root2.pingedLanes) & renderLanes2);
    }
    function computeExpirationTime(lane, currentTime) {
      switch (lane) {
        case 1:
        case 2:
        case 4:
        case 8:
        case 64:
          return currentTime + 250;
        case 16:
        case 32:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return currentTime + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          return -1;
        case 67108864:
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
          return -1;
        default:
          return -1;
      }
    }
    function claimNextRetryLane() {
      var lane = nextRetryLane;
      nextRetryLane <<= 1;
      0 === (nextRetryLane & 62914560) && (nextRetryLane = 4194304);
      return lane;
    }
    function createLaneMap(initial) {
      for (var laneMap = [], i = 0; 31 > i; i++) laneMap.push(initial);
      return laneMap;
    }
    function markRootUpdated$1(root2, updateLane) {
      root2.pendingLanes |= updateLane;
      268435456 !== updateLane && (root2.suspendedLanes = 0, root2.pingedLanes = 0, root2.warmLanes = 0);
    }
    function markRootFinished(root2, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
      var previouslyPendingLanes = root2.pendingLanes;
      root2.pendingLanes = remainingLanes;
      root2.suspendedLanes = 0;
      root2.pingedLanes = 0;
      root2.warmLanes = 0;
      root2.expiredLanes &= remainingLanes;
      root2.entangledLanes &= remainingLanes;
      root2.errorRecoveryDisabledLanes &= remainingLanes;
      root2.shellSuspendCounter = 0;
      var entanglements = root2.entanglements, expirationTimes = root2.expirationTimes, hiddenUpdates = root2.hiddenUpdates;
      for (remainingLanes = previouslyPendingLanes & ~remainingLanes; 0 < remainingLanes; ) {
        var index$7 = 31 - clz32(remainingLanes), lane = 1 << index$7;
        entanglements[index$7] = 0;
        expirationTimes[index$7] = -1;
        var hiddenUpdatesForLane = hiddenUpdates[index$7];
        if (null !== hiddenUpdatesForLane)
          for (hiddenUpdates[index$7] = null, index$7 = 0; index$7 < hiddenUpdatesForLane.length; index$7++) {
            var update = hiddenUpdatesForLane[index$7];
            null !== update && (update.lane &= -536870913);
          }
        remainingLanes &= ~lane;
      }
      0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, 0);
      0 !== suspendedRetryLanes && 0 === updatedLanes && 0 !== root2.tag && (root2.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
    }
    function markSpawnedDeferredLane(root2, spawnedLane, entangledLanes) {
      root2.pendingLanes |= spawnedLane;
      root2.suspendedLanes &= ~spawnedLane;
      var spawnedLaneIndex = 31 - clz32(spawnedLane);
      root2.entangledLanes |= spawnedLane;
      root2.entanglements[spawnedLaneIndex] = root2.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 261930;
    }
    function markRootEntangled(root2, entangledLanes) {
      var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
      for (root2 = root2.entanglements; rootEntangledLanes; ) {
        var index$8 = 31 - clz32(rootEntangledLanes), lane = 1 << index$8;
        lane & entangledLanes | root2[index$8] & entangledLanes && (root2[index$8] |= entangledLanes);
        rootEntangledLanes &= ~lane;
      }
    }
    function getBumpedLaneForHydration(root2, renderLanes2) {
      var renderLane = renderLanes2 & -renderLanes2;
      renderLane = 0 !== (renderLane & 42) ? 1 : getBumpedLaneForHydrationByLane(renderLane);
      return 0 !== (renderLane & (root2.suspendedLanes | renderLanes2)) ? 0 : renderLane;
    }
    function getBumpedLaneForHydrationByLane(lane) {
      switch (lane) {
        case 2:
          lane = 1;
          break;
        case 8:
          lane = 4;
          break;
        case 32:
          lane = 16;
          break;
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
          lane = 128;
          break;
        case 268435456:
          lane = 134217728;
          break;
        default:
          lane = 0;
      }
      return lane;
    }
    function lanesToEventPriority(lanes) {
      lanes &= -lanes;
      return 2 < lanes ? 8 < lanes ? 0 !== (lanes & 134217727) ? 32 : 268435456 : 8 : 2;
    }
    function resolveUpdatePriority() {
      var updatePriority = ReactDOMSharedInternals.p;
      if (0 !== updatePriority) return updatePriority;
      updatePriority = window.event;
      return void 0 === updatePriority ? 32 : getEventPriority(updatePriority.type);
    }
    function runWithPriority(priority, fn) {
      var previousPriority = ReactDOMSharedInternals.p;
      try {
        return ReactDOMSharedInternals.p = priority, fn();
      } finally {
        ReactDOMSharedInternals.p = previousPriority;
      }
    }
    var randomKey = Math.random().toString(36).slice(2);
    var internalInstanceKey = "__reactFiber$" + randomKey;
    var internalPropsKey = "__reactProps$" + randomKey;
    var internalContainerInstanceKey = "__reactContainer$" + randomKey;
    var internalEventHandlersKey = "__reactEvents$" + randomKey;
    var internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
    var internalEventHandlesSetKey = "__reactHandles$" + randomKey;
    var internalRootNodeResourcesKey = "__reactResources$" + randomKey;
    var internalHoistableMarker = "__reactMarker$" + randomKey;
    function detachDeletedInstance(node) {
      delete node[internalInstanceKey];
      delete node[internalPropsKey];
      delete node[internalEventHandlersKey];
      delete node[internalEventHandlerListenersKey];
      delete node[internalEventHandlesSetKey];
    }
    function getClosestInstanceFromNode(targetNode) {
      var targetInst = targetNode[internalInstanceKey];
      if (targetInst) return targetInst;
      for (var parentNode = targetNode.parentNode; parentNode; ) {
        if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
          parentNode = targetInst.alternate;
          if (null !== targetInst.child || null !== parentNode && null !== parentNode.child)
            for (targetNode = getParentHydrationBoundary(targetNode); null !== targetNode; ) {
              if (parentNode = targetNode[internalInstanceKey]) return parentNode;
              targetNode = getParentHydrationBoundary(targetNode);
            }
          return targetInst;
        }
        targetNode = parentNode;
        parentNode = targetNode.parentNode;
      }
      return null;
    }
    function getInstanceFromNode(node) {
      if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
        var tag = node.tag;
        if (5 === tag || 6 === tag || 13 === tag || 31 === tag || 26 === tag || 27 === tag || 3 === tag)
          return node;
      }
      return null;
    }
    function getNodeFromInstance(inst) {
      var tag = inst.tag;
      if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return inst.stateNode;
      throw Error(formatProdErrorMessage(33));
    }
    function getResourcesFromRoot(root2) {
      var resources = root2[internalRootNodeResourcesKey];
      resources || (resources = root2[internalRootNodeResourcesKey] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() });
      return resources;
    }
    function markNodeAsHoistable(node) {
      node[internalHoistableMarker] = true;
    }
    var allNativeEvents = /* @__PURE__ */ new Set();
    var registrationNameDependencies = {};
    function registerTwoPhaseEvent(registrationName, dependencies) {
      registerDirectEvent(registrationName, dependencies);
      registerDirectEvent(registrationName + "Capture", dependencies);
    }
    function registerDirectEvent(registrationName, dependencies) {
      registrationNameDependencies[registrationName] = dependencies;
      for (registrationName = 0; registrationName < dependencies.length; registrationName++)
        allNativeEvents.add(dependencies[registrationName]);
    }
    var VALID_ATTRIBUTE_NAME_REGEX = RegExp(
      "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
    );
    var illegalAttributeNameCache = {};
    var validatedAttributeNameCache = {};
    function isAttributeNameSafe(attributeName) {
      if (hasOwnProperty.call(validatedAttributeNameCache, attributeName))
        return true;
      if (hasOwnProperty.call(illegalAttributeNameCache, attributeName)) return false;
      if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
        return validatedAttributeNameCache[attributeName] = true;
      illegalAttributeNameCache[attributeName] = true;
      return false;
    }
    function setValueForAttribute(node, name, value) {
      if (isAttributeNameSafe(name))
        if (null === value) node.removeAttribute(name);
        else {
          switch (typeof value) {
            case "undefined":
            case "function":
            case "symbol":
              node.removeAttribute(name);
              return;
            case "boolean":
              var prefix$10 = name.toLowerCase().slice(0, 5);
              if ("data-" !== prefix$10 && "aria-" !== prefix$10) {
                node.removeAttribute(name);
                return;
              }
          }
          node.setAttribute(name, "" + value);
        }
    }
    function setValueForKnownAttribute(node, name, value) {
      if (null === value) node.removeAttribute(name);
      else {
        switch (typeof value) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            node.removeAttribute(name);
            return;
        }
        node.setAttribute(name, "" + value);
      }
    }
    function setValueForNamespacedAttribute(node, namespace, name, value) {
      if (null === value) node.removeAttribute(name);
      else {
        switch (typeof value) {
          case "undefined":
          case "function":
          case "symbol":
          case "boolean":
            node.removeAttribute(name);
            return;
        }
        node.setAttributeNS(namespace, name, "" + value);
      }
    }
    function getToStringValue(value) {
      switch (typeof value) {
        case "bigint":
        case "boolean":
        case "number":
        case "string":
        case "undefined":
          return value;
        case "object":
          return value;
        default:
          return "";
      }
    }
    function isCheckable(elem) {
      var type = elem.type;
      return (elem = elem.nodeName) && "input" === elem.toLowerCase() && ("checkbox" === type || "radio" === type);
    }
    function trackValueOnNode(node, valueField, currentValue) {
      var descriptor = Object.getOwnPropertyDescriptor(
        node.constructor.prototype,
        valueField
      );
      if (!node.hasOwnProperty(valueField) && "undefined" !== typeof descriptor && "function" === typeof descriptor.get && "function" === typeof descriptor.set) {
        var get2 = descriptor.get, set2 = descriptor.set;
        Object.defineProperty(node, valueField, {
          configurable: true,
          get: function() {
            return get2.call(this);
          },
          set: function(value) {
            currentValue = "" + value;
            set2.call(this, value);
          }
        });
        Object.defineProperty(node, valueField, {
          enumerable: descriptor.enumerable
        });
        return {
          getValue: function() {
            return currentValue;
          },
          setValue: function(value) {
            currentValue = "" + value;
          },
          stopTracking: function() {
            node._valueTracker = null;
            delete node[valueField];
          }
        };
      }
    }
    function track(node) {
      if (!node._valueTracker) {
        var valueField = isCheckable(node) ? "checked" : "value";
        node._valueTracker = trackValueOnNode(
          node,
          valueField,
          "" + node[valueField]
        );
      }
    }
    function updateValueIfChanged(node) {
      if (!node) return false;
      var tracker = node._valueTracker;
      if (!tracker) return true;
      var lastValue = tracker.getValue();
      var value = "";
      node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
      node = value;
      return node !== lastValue ? (tracker.setValue(node), true) : false;
    }
    function getActiveElement(doc) {
      doc = doc || ("undefined" !== typeof document ? document : void 0);
      if ("undefined" === typeof doc) return null;
      try {
        return doc.activeElement || doc.body;
      } catch (e) {
        return doc.body;
      }
    }
    var escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
    function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
      return value.replace(
        escapeSelectorAttributeValueInsideDoubleQuotesRegex,
        function(ch) {
          return "\\" + ch.charCodeAt(0).toString(16) + " ";
        }
      );
    }
    function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name) {
      element.name = "";
      null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type ? element.type = type : element.removeAttribute("type");
      if (null != value)
        if ("number" === type) {
          if (0 === value && "" === element.value || element.value != value)
            element.value = "" + getToStringValue(value);
        } else
          element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
      else
        "submit" !== type && "reset" !== type || element.removeAttribute("value");
      null != value ? setDefaultValue(element, type, getToStringValue(value)) : null != defaultValue ? setDefaultValue(element, type, getToStringValue(defaultValue)) : null != lastDefaultValue && element.removeAttribute("value");
      null == checked && null != defaultChecked && (element.defaultChecked = !!defaultChecked);
      null != checked && (element.checked = checked && "function" !== typeof checked && "symbol" !== typeof checked);
      null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
    }
    function initInput(element, value, defaultValue, checked, defaultChecked, type, name, isHydrating2) {
      null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type && (element.type = type);
      if (null != value || null != defaultValue) {
        if (!("submit" !== type && "reset" !== type || void 0 !== value && null !== value)) {
          track(element);
          return;
        }
        defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
        value = null != value ? "" + getToStringValue(value) : defaultValue;
        isHydrating2 || value === element.value || (element.value = value);
        element.defaultValue = value;
      }
      checked = null != checked ? checked : defaultChecked;
      checked = "function" !== typeof checked && "symbol" !== typeof checked && !!checked;
      element.checked = isHydrating2 ? element.checked : !!checked;
      element.defaultChecked = !!checked;
      null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name && (element.name = name);
      track(element);
    }
    function setDefaultValue(node, type, value) {
      "number" === type && getActiveElement(node.ownerDocument) === node || node.defaultValue === "" + value || (node.defaultValue = "" + value);
    }
    function updateOptions(node, multiple, propValue, setDefaultSelected) {
      node = node.options;
      if (multiple) {
        multiple = {};
        for (var i = 0; i < propValue.length; i++)
          multiple["$" + propValue[i]] = true;
        for (propValue = 0; propValue < node.length; propValue++)
          i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
      } else {
        propValue = "" + getToStringValue(propValue);
        multiple = null;
        for (i = 0; i < node.length; i++) {
          if (node[i].value === propValue) {
            node[i].selected = true;
            setDefaultSelected && (node[i].defaultSelected = true);
            return;
          }
          null !== multiple || node[i].disabled || (multiple = node[i]);
        }
        null !== multiple && (multiple.selected = true);
      }
    }
    function updateTextarea(element, value, defaultValue) {
      if (null != value && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), null == defaultValue)) {
        element.defaultValue !== value && (element.defaultValue = value);
        return;
      }
      element.defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
    }
    function initTextarea(element, value, defaultValue, children) {
      if (null == value) {
        if (null != children) {
          if (null != defaultValue) throw Error(formatProdErrorMessage(92));
          if (isArrayImpl(children)) {
            if (1 < children.length) throw Error(formatProdErrorMessage(93));
            children = children[0];
          }
          defaultValue = children;
        }
        null == defaultValue && (defaultValue = "");
        value = defaultValue;
      }
      defaultValue = getToStringValue(value);
      element.defaultValue = defaultValue;
      children = element.textContent;
      children === defaultValue && "" !== children && null !== children && (element.value = children);
      track(element);
    }
    function setTextContent(node, text) {
      if (text) {
        var firstChild = node.firstChild;
        if (firstChild && firstChild === node.lastChild && 3 === firstChild.nodeType) {
          firstChild.nodeValue = text;
          return;
        }
      }
      node.textContent = text;
    }
    var unitlessNumbers = new Set(
      "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
        " "
      )
    );
    function setValueForStyle(style2, styleName, value) {
      var isCustomProperty = 0 === styleName.indexOf("--");
      null == value || "boolean" === typeof value || "" === value ? isCustomProperty ? style2.setProperty(styleName, "") : "float" === styleName ? style2.cssFloat = "" : style2[styleName] = "" : isCustomProperty ? style2.setProperty(styleName, value) : "number" !== typeof value || 0 === value || unitlessNumbers.has(styleName) ? "float" === styleName ? style2.cssFloat = value : style2[styleName] = ("" + value).trim() : style2[styleName] = value + "px";
    }
    function setValueForStyles(node, styles, prevStyles) {
      if (null != styles && "object" !== typeof styles)
        throw Error(formatProdErrorMessage(62));
      node = node.style;
      if (null != prevStyles) {
        for (var styleName in prevStyles)
          !prevStyles.hasOwnProperty(styleName) || null != styles && styles.hasOwnProperty(styleName) || (0 === styleName.indexOf("--") ? node.setProperty(styleName, "") : "float" === styleName ? node.cssFloat = "" : node[styleName] = "");
        for (var styleName$16 in styles)
          styleName = styles[styleName$16], styles.hasOwnProperty(styleName$16) && prevStyles[styleName$16] !== styleName && setValueForStyle(node, styleName$16, styleName);
      } else
        for (var styleName$17 in styles)
          styles.hasOwnProperty(styleName$17) && setValueForStyle(node, styleName$17, styles[styleName$17]);
    }
    function isCustomElement(tagName) {
      if (-1 === tagName.indexOf("-")) return false;
      switch (tagName) {
        case "annotation-xml":
        case "color-profile":
        case "font-face":
        case "font-face-src":
        case "font-face-uri":
        case "font-face-format":
        case "font-face-name":
        case "missing-glyph":
          return false;
        default:
          return true;
      }
    }
    var aliases = /* @__PURE__ */ new Map([
      ["acceptCharset", "accept-charset"],
      ["htmlFor", "for"],
      ["httpEquiv", "http-equiv"],
      ["crossOrigin", "crossorigin"],
      ["accentHeight", "accent-height"],
      ["alignmentBaseline", "alignment-baseline"],
      ["arabicForm", "arabic-form"],
      ["baselineShift", "baseline-shift"],
      ["capHeight", "cap-height"],
      ["clipPath", "clip-path"],
      ["clipRule", "clip-rule"],
      ["colorInterpolation", "color-interpolation"],
      ["colorInterpolationFilters", "color-interpolation-filters"],
      ["colorProfile", "color-profile"],
      ["colorRendering", "color-rendering"],
      ["dominantBaseline", "dominant-baseline"],
      ["enableBackground", "enable-background"],
      ["fillOpacity", "fill-opacity"],
      ["fillRule", "fill-rule"],
      ["floodColor", "flood-color"],
      ["floodOpacity", "flood-opacity"],
      ["fontFamily", "font-family"],
      ["fontSize", "font-size"],
      ["fontSizeAdjust", "font-size-adjust"],
      ["fontStretch", "font-stretch"],
      ["fontStyle", "font-style"],
      ["fontVariant", "font-variant"],
      ["fontWeight", "font-weight"],
      ["glyphName", "glyph-name"],
      ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
      ["glyphOrientationVertical", "glyph-orientation-vertical"],
      ["horizAdvX", "horiz-adv-x"],
      ["horizOriginX", "horiz-origin-x"],
      ["imageRendering", "image-rendering"],
      ["letterSpacing", "letter-spacing"],
      ["lightingColor", "lighting-color"],
      ["markerEnd", "marker-end"],
      ["markerMid", "marker-mid"],
      ["markerStart", "marker-start"],
      ["overlinePosition", "overline-position"],
      ["overlineThickness", "overline-thickness"],
      ["paintOrder", "paint-order"],
      ["panose-1", "panose-1"],
      ["pointerEvents", "pointer-events"],
      ["renderingIntent", "rendering-intent"],
      ["shapeRendering", "shape-rendering"],
      ["stopColor", "stop-color"],
      ["stopOpacity", "stop-opacity"],
      ["strikethroughPosition", "strikethrough-position"],
      ["strikethroughThickness", "strikethrough-thickness"],
      ["strokeDasharray", "stroke-dasharray"],
      ["strokeDashoffset", "stroke-dashoffset"],
      ["strokeLinecap", "stroke-linecap"],
      ["strokeLinejoin", "stroke-linejoin"],
      ["strokeMiterlimit", "stroke-miterlimit"],
      ["strokeOpacity", "stroke-opacity"],
      ["strokeWidth", "stroke-width"],
      ["textAnchor", "text-anchor"],
      ["textDecoration", "text-decoration"],
      ["textRendering", "text-rendering"],
      ["transformOrigin", "transform-origin"],
      ["underlinePosition", "underline-position"],
      ["underlineThickness", "underline-thickness"],
      ["unicodeBidi", "unicode-bidi"],
      ["unicodeRange", "unicode-range"],
      ["unitsPerEm", "units-per-em"],
      ["vAlphabetic", "v-alphabetic"],
      ["vHanging", "v-hanging"],
      ["vIdeographic", "v-ideographic"],
      ["vMathematical", "v-mathematical"],
      ["vectorEffect", "vector-effect"],
      ["vertAdvY", "vert-adv-y"],
      ["vertOriginX", "vert-origin-x"],
      ["vertOriginY", "vert-origin-y"],
      ["wordSpacing", "word-spacing"],
      ["writingMode", "writing-mode"],
      ["xmlnsXlink", "xmlns:xlink"],
      ["xHeight", "x-height"]
    ]);
    var isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
    function sanitizeURL(url) {
      return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
    }
    function noop$1() {
    }
    var currentReplayingEvent = null;
    function getEventTarget(nativeEvent) {
      nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
      nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
      return 3 === nativeEvent.nodeType ? nativeEvent.parentNode : nativeEvent;
    }
    var restoreTarget = null;
    var restoreQueue = null;
    function restoreStateOfTarget(target) {
      var internalInstance = getInstanceFromNode(target);
      if (internalInstance && (target = internalInstance.stateNode)) {
        var props = target[internalPropsKey] || null;
        a: switch (target = internalInstance.stateNode, internalInstance.type) {
          case "input":
            updateInput(
              target,
              props.value,
              props.defaultValue,
              props.defaultValue,
              props.checked,
              props.defaultChecked,
              props.type,
              props.name
            );
            internalInstance = props.name;
            if ("radio" === props.type && null != internalInstance) {
              for (props = target; props.parentNode; ) props = props.parentNode;
              props = props.querySelectorAll(
                'input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes(
                  "" + internalInstance
                ) + '"][type="radio"]'
              );
              for (internalInstance = 0; internalInstance < props.length; internalInstance++) {
                var otherNode = props[internalInstance];
                if (otherNode !== target && otherNode.form === target.form) {
                  var otherProps = otherNode[internalPropsKey] || null;
                  if (!otherProps) throw Error(formatProdErrorMessage(90));
                  updateInput(
                    otherNode,
                    otherProps.value,
                    otherProps.defaultValue,
                    otherProps.defaultValue,
                    otherProps.checked,
                    otherProps.defaultChecked,
                    otherProps.type,
                    otherProps.name
                  );
                }
              }
              for (internalInstance = 0; internalInstance < props.length; internalInstance++)
                otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
            }
            break a;
          case "textarea":
            updateTextarea(target, props.value, props.defaultValue);
            break a;
          case "select":
            internalInstance = props.value, null != internalInstance && updateOptions(target, !!props.multiple, internalInstance, false);
        }
      }
    }
    var isInsideEventHandler = false;
    function batchedUpdates$1(fn, a, b) {
      if (isInsideEventHandler) return fn(a, b);
      isInsideEventHandler = true;
      try {
        var JSCompiler_inline_result = fn(a);
        return JSCompiler_inline_result;
      } finally {
        if (isInsideEventHandler = false, null !== restoreTarget || null !== restoreQueue) {
          if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
            for (a = 0; a < fn.length; a++) restoreStateOfTarget(fn[a]);
        }
      }
    }
    function getListener(inst, registrationName) {
      var stateNode = inst.stateNode;
      if (null === stateNode) return null;
      var props = stateNode[internalPropsKey] || null;
      if (null === props) return null;
      stateNode = props[registrationName];
      a: switch (registrationName) {
        case "onClick":
        case "onClickCapture":
        case "onDoubleClick":
        case "onDoubleClickCapture":
        case "onMouseDown":
        case "onMouseDownCapture":
        case "onMouseMove":
        case "onMouseMoveCapture":
        case "onMouseUp":
        case "onMouseUpCapture":
        case "onMouseEnter":
          (props = !props.disabled) || (inst = inst.type, props = !("button" === inst || "input" === inst || "select" === inst || "textarea" === inst));
          inst = !props;
          break a;
        default:
          inst = false;
      }
      if (inst) return null;
      if (stateNode && "function" !== typeof stateNode)
        throw Error(
          formatProdErrorMessage(231, registrationName, typeof stateNode)
        );
      return stateNode;
    }
    var canUseDOM = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement);
    var passiveBrowserEventsSupported = false;
    if (canUseDOM)
      try {
        options = {};
        Object.defineProperty(options, "passive", {
          get: function() {
            passiveBrowserEventsSupported = true;
          }
        });
        window.addEventListener("test", options, options);
        window.removeEventListener("test", options, options);
      } catch (e) {
        passiveBrowserEventsSupported = false;
      }
    var options;
    var root = null;
    var startText = null;
    var fallbackText = null;
    function getData() {
      if (fallbackText) return fallbackText;
      var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
      for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
      var minEnd = startLength - start;
      for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
      return fallbackText = endValue.slice(start, 1 < end ? 1 - end : void 0);
    }
    function getEventCharCode(nativeEvent) {
      var keyCode = nativeEvent.keyCode;
      "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, 0 === nativeEvent && 13 === keyCode && (nativeEvent = 13)) : nativeEvent = keyCode;
      10 === nativeEvent && (nativeEvent = 13);
      return 32 <= nativeEvent || 13 === nativeEvent ? nativeEvent : 0;
    }
    function functionThatReturnsTrue() {
      return true;
    }
    function functionThatReturnsFalse() {
      return false;
    }
    function createSyntheticEvent(Interface) {
      function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
        this._reactName = reactName;
        this._targetInst = targetInst;
        this.type = reactEventType;
        this.nativeEvent = nativeEvent;
        this.target = nativeEventTarget;
        this.currentTarget = null;
        for (var propName in Interface)
          Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
        this.isDefaultPrevented = (null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : false === nativeEvent.returnValue) ? functionThatReturnsTrue : functionThatReturnsFalse;
        this.isPropagationStopped = functionThatReturnsFalse;
        return this;
      }
      assign(SyntheticBaseEvent.prototype, {
        preventDefault: function() {
          this.defaultPrevented = true;
          var event = this.nativeEvent;
          event && (event.preventDefault ? event.preventDefault() : "unknown" !== typeof event.returnValue && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
        },
        stopPropagation: function() {
          var event = this.nativeEvent;
          event && (event.stopPropagation ? event.stopPropagation() : "unknown" !== typeof event.cancelBubble && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
        },
        persist: function() {
        },
        isPersistent: functionThatReturnsTrue
      });
      return SyntheticBaseEvent;
    }
    var EventInterface = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function(event) {
        return event.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0
    };
    var SyntheticEvent = createSyntheticEvent(EventInterface);
    var UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 });
    var SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
    var lastMovementX;
    var lastMovementY;
    var lastMouseEvent;
    var MouseEventInterface = assign({}, UIEventInterface, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: getEventModifierState,
      button: 0,
      buttons: 0,
      relatedTarget: function(event) {
        return void 0 === event.relatedTarget ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
      },
      movementX: function(event) {
        if ("movementX" in event) return event.movementX;
        event !== lastMouseEvent && (lastMouseEvent && "mousemove" === event.type ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
        return lastMovementX;
      },
      movementY: function(event) {
        return "movementY" in event ? event.movementY : lastMovementY;
      }
    });
    var SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
    var DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 });
    var SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
    var FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 });
    var SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
    var AnimationEventInterface = assign({}, EventInterface, {
      animationName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    });
    var SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
    var ClipboardEventInterface = assign({}, EventInterface, {
      clipboardData: function(event) {
        return "clipboardData" in event ? event.clipboardData : window.clipboardData;
      }
    });
    var SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
    var CompositionEventInterface = assign({}, EventInterface, { data: 0 });
    var SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
    var normalizeKey = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified"
    };
    var translateToKey = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta"
    };
    var modifierKeyToProp = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey"
    };
    function modifierStateGetter(keyArg) {
      var nativeEvent = this.nativeEvent;
      return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
    }
    function getEventModifierState() {
      return modifierStateGetter;
    }
    var KeyboardEventInterface = assign({}, UIEventInterface, {
      key: function(nativeEvent) {
        if (nativeEvent.key) {
          var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
          if ("Unidentified" !== key) return key;
        }
        return "keypress" === nativeEvent.type ? (nativeEvent = getEventCharCode(nativeEvent), 13 === nativeEvent ? "Enter" : String.fromCharCode(nativeEvent)) : "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: getEventModifierState,
      charCode: function(event) {
        return "keypress" === event.type ? getEventCharCode(event) : 0;
      },
      keyCode: function(event) {
        return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
      },
      which: function(event) {
        return "keypress" === event.type ? getEventCharCode(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
      }
    });
    var SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
    var PointerEventInterface = assign({}, MouseEventInterface, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0
    });
    var SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
    var TouchEventInterface = assign({}, UIEventInterface, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: getEventModifierState
    });
    var SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
    var TransitionEventInterface = assign({}, EventInterface, {
      propertyName: 0,
      elapsedTime: 0,
      pseudoElement: 0
    });
    var SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
    var WheelEventInterface = assign({}, MouseEventInterface, {
      deltaX: function(event) {
        return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
      },
      deltaY: function(event) {
        return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    });
    var SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
    var ToggleEventInterface = assign({}, EventInterface, {
      newState: 0,
      oldState: 0
    });
    var SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);
    var END_KEYCODES = [9, 13, 27, 32];
    var canUseCompositionEvent = canUseDOM && "CompositionEvent" in window;
    var documentMode = null;
    canUseDOM && "documentMode" in document && (documentMode = document.documentMode);
    var canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode;
    var useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode);
    var SPACEBAR_CHAR = String.fromCharCode(32);
    var hasSpaceKeypress = false;
    function isFallbackCompositionEnd(domEventName, nativeEvent) {
      switch (domEventName) {
        case "keyup":
          return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);
        case "keydown":
          return 229 !== nativeEvent.keyCode;
        case "keypress":
        case "mousedown":
        case "focusout":
          return true;
        default:
          return false;
      }
    }
    function getDataFromCustomEvent(nativeEvent) {
      nativeEvent = nativeEvent.detail;
      return "object" === typeof nativeEvent && "data" in nativeEvent ? nativeEvent.data : null;
    }
    var isComposing = false;
    function getNativeBeforeInputChars(domEventName, nativeEvent) {
      switch (domEventName) {
        case "compositionend":
          return getDataFromCustomEvent(nativeEvent);
        case "keypress":
          if (32 !== nativeEvent.which) return null;
          hasSpaceKeypress = true;
          return SPACEBAR_CHAR;
        case "textInput":
          return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
        default:
          return null;
      }
    }
    function getFallbackBeforeInputChars(domEventName, nativeEvent) {
      if (isComposing)
        return "compositionend" === domEventName || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
      switch (domEventName) {
        case "paste":
          return null;
        case "keypress":
          if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
            if (nativeEvent.char && 1 < nativeEvent.char.length)
              return nativeEvent.char;
            if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
          }
          return null;
        case "compositionend":
          return useFallbackCompositionData && "ko" !== nativeEvent.locale ? null : nativeEvent.data;
        default:
          return null;
      }
    }
    var supportedInputTypes = {
      color: true,
      date: true,
      datetime: true,
      "datetime-local": true,
      email: true,
      month: true,
      number: true,
      password: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true
    };
    function isTextInputElement(elem) {
      var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
      return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName ? true : false;
    }
    function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
      restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
      inst = accumulateTwoPhaseListeners(inst, "onChange");
      0 < inst.length && (nativeEvent = new SyntheticEvent(
        "onChange",
        "change",
        null,
        nativeEvent,
        target
      ), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
    }
    var activeElement$1 = null;
    var activeElementInst$1 = null;
    function runEventInBatch(dispatchQueue) {
      processDispatchQueue(dispatchQueue, 0);
    }
    function getInstIfValueChanged(targetInst) {
      var targetNode = getNodeFromInstance(targetInst);
      if (updateValueIfChanged(targetNode)) return targetInst;
    }
    function getTargetInstForChangeEvent(domEventName, targetInst) {
      if ("change" === domEventName) return targetInst;
    }
    var isInputEventSupported = false;
    if (canUseDOM) {
      if (canUseDOM) {
        isSupported$jscomp$inline_427 = "oninput" in document;
        if (!isSupported$jscomp$inline_427) {
          element$jscomp$inline_428 = document.createElement("div");
          element$jscomp$inline_428.setAttribute("oninput", "return;");
          isSupported$jscomp$inline_427 = "function" === typeof element$jscomp$inline_428.oninput;
        }
        JSCompiler_inline_result$jscomp$286 = isSupported$jscomp$inline_427;
      } else JSCompiler_inline_result$jscomp$286 = false;
      isInputEventSupported = JSCompiler_inline_result$jscomp$286 && (!document.documentMode || 9 < document.documentMode);
    }
    var JSCompiler_inline_result$jscomp$286;
    var isSupported$jscomp$inline_427;
    var element$jscomp$inline_428;
    function stopWatchingForValueChange() {
      activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
    }
    function handlePropertyChange(nativeEvent) {
      if ("value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst$1)) {
        var dispatchQueue = [];
        createAndAccumulateChangeEvent(
          dispatchQueue,
          activeElementInst$1,
          nativeEvent,
          getEventTarget(nativeEvent)
        );
        batchedUpdates$1(runEventInBatch, dispatchQueue);
      }
    }
    function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
      "focusin" === domEventName ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : "focusout" === domEventName && stopWatchingForValueChange();
    }
    function getTargetInstForInputEventPolyfill(domEventName) {
      if ("selectionchange" === domEventName || "keyup" === domEventName || "keydown" === domEventName)
        return getInstIfValueChanged(activeElementInst$1);
    }
    function getTargetInstForClickEvent(domEventName, targetInst) {
      if ("click" === domEventName) return getInstIfValueChanged(targetInst);
    }
    function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
      if ("input" === domEventName || "change" === domEventName)
        return getInstIfValueChanged(targetInst);
    }
    function is2(x, y2) {
      return x === y2 && (0 !== x || 1 / x === 1 / y2) || x !== x && y2 !== y2;
    }
    var objectIs = "function" === typeof Object.is ? Object.is : is2;
    function shallowEqual(objA, objB) {
      if (objectIs(objA, objB)) return true;
      if ("object" !== typeof objA || null === objA || "object" !== typeof objB || null === objB)
        return false;
      var keysA = Object.keys(objA), keysB = Object.keys(objB);
      if (keysA.length !== keysB.length) return false;
      for (keysB = 0; keysB < keysA.length; keysB++) {
        var currentKey = keysA[keysB];
        if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
          return false;
      }
      return true;
    }
    function getLeafNode(node) {
      for (; node && node.firstChild; ) node = node.firstChild;
      return node;
    }
    function getNodeForCharacterOffset(root2, offset) {
      var node = getLeafNode(root2);
      root2 = 0;
      for (var nodeEnd; node; ) {
        if (3 === node.nodeType) {
          nodeEnd = root2 + node.textContent.length;
          if (root2 <= offset && nodeEnd >= offset)
            return { node, offset: offset - root2 };
          root2 = nodeEnd;
        }
        a: {
          for (; node; ) {
            if (node.nextSibling) {
              node = node.nextSibling;
              break a;
            }
            node = node.parentNode;
          }
          node = void 0;
        }
        node = getLeafNode(node);
      }
    }
    function containsNode(outerNode, innerNode) {
      return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && 3 === outerNode.nodeType ? false : innerNode && 3 === innerNode.nodeType ? containsNode(outerNode, innerNode.parentNode) : "contains" in outerNode ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
    }
    function getActiveElementDeep(containerInfo) {
      containerInfo = null != containerInfo && null != containerInfo.ownerDocument && null != containerInfo.ownerDocument.defaultView ? containerInfo.ownerDocument.defaultView : window;
      for (var element = getActiveElement(containerInfo.document); element instanceof containerInfo.HTMLIFrameElement; ) {
        try {
          var JSCompiler_inline_result = "string" === typeof element.contentWindow.location.href;
        } catch (err) {
          JSCompiler_inline_result = false;
        }
        if (JSCompiler_inline_result) containerInfo = element.contentWindow;
        else break;
        element = getActiveElement(containerInfo.document);
      }
      return element;
    }
    function hasSelectionCapabilities(elem) {
      var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
      return nodeName && ("input" === nodeName && ("text" === elem.type || "search" === elem.type || "tel" === elem.type || "url" === elem.type || "password" === elem.type) || "textarea" === nodeName || "true" === elem.contentEditable);
    }
    var skipSelectionChangeEvent = canUseDOM && "documentMode" in document && 11 >= document.documentMode;
    var activeElement = null;
    var activeElementInst = null;
    var lastSelection = null;
    var mouseDown = false;
    function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
      var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : 9 === nativeEventTarget.nodeType ? nativeEventTarget : nativeEventTarget.ownerDocument;
      mouseDown || null == activeElement || activeElement !== getActiveElement(doc) || (doc = activeElement, "selectionStart" in doc && hasSelectionCapabilities(doc) ? doc = { start: doc.selectionStart, end: doc.selectionEnd } : (doc = (doc.ownerDocument && doc.ownerDocument.defaultView || window).getSelection(), doc = {
        anchorNode: doc.anchorNode,
        anchorOffset: doc.anchorOffset,
        focusNode: doc.focusNode,
        focusOffset: doc.focusOffset
      }), lastSelection && shallowEqual(lastSelection, doc) || (lastSelection = doc, doc = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc.length && (nativeEvent = new SyntheticEvent(
        "onSelect",
        "select",
        null,
        nativeEvent,
        nativeEventTarget
      ), dispatchQueue.push({ event: nativeEvent, listeners: doc }), nativeEvent.target = activeElement)));
    }
    function makePrefixMap(styleProp, eventName) {
      var prefixes = {};
      prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
      prefixes["Webkit" + styleProp] = "webkit" + eventName;
      prefixes["Moz" + styleProp] = "moz" + eventName;
      return prefixes;
    }
    var vendorPrefixes = {
      animationend: makePrefixMap("Animation", "AnimationEnd"),
      animationiteration: makePrefixMap("Animation", "AnimationIteration"),
      animationstart: makePrefixMap("Animation", "AnimationStart"),
      transitionrun: makePrefixMap("Transition", "TransitionRun"),
      transitionstart: makePrefixMap("Transition", "TransitionStart"),
      transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
      transitionend: makePrefixMap("Transition", "TransitionEnd")
    };
    var prefixedEventNames = {};
    var style = {};
    canUseDOM && (style = document.createElement("div").style, "AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), "TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);
    function getVendorPrefixedEventName(eventName) {
      if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
      if (!vendorPrefixes[eventName]) return eventName;
      var prefixMap = vendorPrefixes[eventName], styleProp;
      for (styleProp in prefixMap)
        if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
          return prefixedEventNames[eventName] = prefixMap[styleProp];
      return eventName;
    }
    var ANIMATION_END = getVendorPrefixedEventName("animationend");
    var ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
    var ANIMATION_START = getVendorPrefixedEventName("animationstart");
    var TRANSITION_RUN = getVendorPrefixedEventName("transitionrun");
    var TRANSITION_START = getVendorPrefixedEventName("transitionstart");
    var TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel");
    var TRANSITION_END = getVendorPrefixedEventName("transitionend");
    var topLevelEventsToReactNames = /* @__PURE__ */ new Map();
    var simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
      " "
    );
    simpleEventPluginEvents.push("scrollEnd");
    function registerSimpleEvent(domEventName, reactName) {
      topLevelEventsToReactNames.set(domEventName, reactName);
      registerTwoPhaseEvent(reactName, [domEventName]);
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    var concurrentQueues = [];
    var concurrentQueuesIndex = 0;
    var concurrentlyUpdatedLanes = 0;
    function finishQueueingConcurrentUpdates() {
      for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0; i < endIndex; ) {
        var fiber = concurrentQueues[i];
        concurrentQueues[i++] = null;
        var queue = concurrentQueues[i];
        concurrentQueues[i++] = null;
        var update = concurrentQueues[i];
        concurrentQueues[i++] = null;
        var lane = concurrentQueues[i];
        concurrentQueues[i++] = null;
        if (null !== queue && null !== update) {
          var pending = queue.pending;
          null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
          queue.pending = update;
        }
        0 !== lane && markUpdateLaneFromFiberToRoot(fiber, update, lane);
      }
    }
    function enqueueUpdate$1(fiber, queue, update, lane) {
      concurrentQueues[concurrentQueuesIndex++] = fiber;
      concurrentQueues[concurrentQueuesIndex++] = queue;
      concurrentQueues[concurrentQueuesIndex++] = update;
      concurrentQueues[concurrentQueuesIndex++] = lane;
      concurrentlyUpdatedLanes |= lane;
      fiber.lanes |= lane;
      fiber = fiber.alternate;
      null !== fiber && (fiber.lanes |= lane);
    }
    function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
      enqueueUpdate$1(fiber, queue, update, lane);
      return getRootForUpdatedFiber(fiber);
    }
    function enqueueConcurrentRenderForLane(fiber, lane) {
      enqueueUpdate$1(fiber, null, null, lane);
      return getRootForUpdatedFiber(fiber);
    }
    function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
      sourceFiber.lanes |= lane;
      var alternate = sourceFiber.alternate;
      null !== alternate && (alternate.lanes |= lane);
      for (var isHidden = false, parent = sourceFiber.return; null !== parent; )
        parent.childLanes |= lane, alternate = parent.alternate, null !== alternate && (alternate.childLanes |= lane), 22 === parent.tag && (sourceFiber = parent.stateNode, null === sourceFiber || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
      return 3 === sourceFiber.tag ? (parent = sourceFiber.stateNode, isHidden && null !== update && (isHidden = 31 - clz32(lane), sourceFiber = parent.hiddenUpdates, alternate = sourceFiber[isHidden], null === alternate ? sourceFiber[isHidden] = [update] : alternate.push(update), update.lane = lane | 536870912), parent) : null;
    }
    function getRootForUpdatedFiber(sourceFiber) {
      if (50 < nestedUpdateCount)
        throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
      for (var parent = sourceFiber.return; null !== parent; )
        sourceFiber = parent, parent = sourceFiber.return;
      return 3 === sourceFiber.tag ? sourceFiber.stateNode : null;
    }
    var emptyContextObject = {};
    function FiberNode(tag, pendingProps, key, mode) {
      this.tag = tag;
      this.key = key;
      this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
      this.index = 0;
      this.refCleanup = this.ref = null;
      this.pendingProps = pendingProps;
      this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
      this.mode = mode;
      this.subtreeFlags = this.flags = 0;
      this.deletions = null;
      this.childLanes = this.lanes = 0;
      this.alternate = null;
    }
    function createFiberImplClass(tag, pendingProps, key, mode) {
      return new FiberNode(tag, pendingProps, key, mode);
    }
    function shouldConstruct(Component) {
      Component = Component.prototype;
      return !(!Component || !Component.isReactComponent);
    }
    function createWorkInProgress(current2, pendingProps) {
      var workInProgress2 = current2.alternate;
      null === workInProgress2 ? (workInProgress2 = createFiberImplClass(
        current2.tag,
        pendingProps,
        current2.key,
        current2.mode
      ), workInProgress2.elementType = current2.elementType, workInProgress2.type = current2.type, workInProgress2.stateNode = current2.stateNode, workInProgress2.alternate = current2, current2.alternate = workInProgress2) : (workInProgress2.pendingProps = pendingProps, workInProgress2.type = current2.type, workInProgress2.flags = 0, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null);
      workInProgress2.flags = current2.flags & 65011712;
      workInProgress2.childLanes = current2.childLanes;
      workInProgress2.lanes = current2.lanes;
      workInProgress2.child = current2.child;
      workInProgress2.memoizedProps = current2.memoizedProps;
      workInProgress2.memoizedState = current2.memoizedState;
      workInProgress2.updateQueue = current2.updateQueue;
      pendingProps = current2.dependencies;
      workInProgress2.dependencies = null === pendingProps ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
      workInProgress2.sibling = current2.sibling;
      workInProgress2.index = current2.index;
      workInProgress2.ref = current2.ref;
      workInProgress2.refCleanup = current2.refCleanup;
      return workInProgress2;
    }
    function resetWorkInProgress(workInProgress2, renderLanes2) {
      workInProgress2.flags &= 65011714;
      var current2 = workInProgress2.alternate;
      null === current2 ? (workInProgress2.childLanes = 0, workInProgress2.lanes = renderLanes2, workInProgress2.child = null, workInProgress2.subtreeFlags = 0, workInProgress2.memoizedProps = null, workInProgress2.memoizedState = null, workInProgress2.updateQueue = null, workInProgress2.dependencies = null, workInProgress2.stateNode = null) : (workInProgress2.childLanes = current2.childLanes, workInProgress2.lanes = current2.lanes, workInProgress2.child = current2.child, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null, workInProgress2.memoizedProps = current2.memoizedProps, workInProgress2.memoizedState = current2.memoizedState, workInProgress2.updateQueue = current2.updateQueue, workInProgress2.type = current2.type, renderLanes2 = current2.dependencies, workInProgress2.dependencies = null === renderLanes2 ? null : {
        lanes: renderLanes2.lanes,
        firstContext: renderLanes2.firstContext
      });
      return workInProgress2;
    }
    function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
      var fiberTag = 0;
      owner = type;
      if ("function" === typeof type) shouldConstruct(type) && (fiberTag = 1);
      else if ("string" === typeof type)
        fiberTag = isHostHoistableType(
          type,
          pendingProps,
          contextStackCursor.current
        ) ? 26 : "html" === type || "head" === type || "body" === type ? 27 : 5;
      else
        a: switch (type) {
          case REACT_ACTIVITY_TYPE:
            return type = createFiberImplClass(31, pendingProps, key, mode), type.elementType = REACT_ACTIVITY_TYPE, type.lanes = lanes, type;
          case REACT_FRAGMENT_TYPE:
            return createFiberFromFragment(pendingProps.children, mode, lanes, key);
          case REACT_STRICT_MODE_TYPE:
            fiberTag = 8;
            mode |= 24;
            break;
          case REACT_PROFILER_TYPE:
            return type = createFiberImplClass(12, pendingProps, key, mode | 2), type.elementType = REACT_PROFILER_TYPE, type.lanes = lanes, type;
          case REACT_SUSPENSE_TYPE:
            return type = createFiberImplClass(13, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_TYPE, type.lanes = lanes, type;
          case REACT_SUSPENSE_LIST_TYPE:
            return type = createFiberImplClass(19, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_LIST_TYPE, type.lanes = lanes, type;
          default:
            if ("object" === typeof type && null !== type)
              switch (type.$$typeof) {
                case REACT_CONTEXT_TYPE:
                  fiberTag = 10;
                  break a;
                case REACT_CONSUMER_TYPE:
                  fiberTag = 9;
                  break a;
                case REACT_FORWARD_REF_TYPE:
                  fiberTag = 11;
                  break a;
                case REACT_MEMO_TYPE:
                  fiberTag = 14;
                  break a;
                case REACT_LAZY_TYPE:
                  fiberTag = 16;
                  owner = null;
                  break a;
              }
            fiberTag = 29;
            pendingProps = Error(
              formatProdErrorMessage(130, null === type ? "null" : typeof type, "")
            );
            owner = null;
        }
      key = createFiberImplClass(fiberTag, pendingProps, key, mode);
      key.elementType = type;
      key.type = owner;
      key.lanes = lanes;
      return key;
    }
    function createFiberFromFragment(elements, mode, lanes, key) {
      elements = createFiberImplClass(7, elements, key, mode);
      elements.lanes = lanes;
      return elements;
    }
    function createFiberFromText(content, mode, lanes) {
      content = createFiberImplClass(6, content, null, mode);
      content.lanes = lanes;
      return content;
    }
    function createFiberFromDehydratedFragment(dehydratedNode) {
      var fiber = createFiberImplClass(18, null, null, 0);
      fiber.stateNode = dehydratedNode;
      return fiber;
    }
    function createFiberFromPortal(portal, mode, lanes) {
      mode = createFiberImplClass(
        4,
        null !== portal.children ? portal.children : [],
        portal.key,
        mode
      );
      mode.lanes = lanes;
      mode.stateNode = {
        containerInfo: portal.containerInfo,
        pendingChildren: null,
        implementation: portal.implementation
      };
      return mode;
    }
    var CapturedStacks = /* @__PURE__ */ new WeakMap();
    function createCapturedValueAtFiber(value, source) {
      if ("object" === typeof value && null !== value) {
        var existing = CapturedStacks.get(value);
        if (void 0 !== existing) return existing;
        source = {
          value,
          source,
          stack: getStackByFiberInDevAndProd(source)
        };
        CapturedStacks.set(value, source);
        return source;
      }
      return {
        value,
        source,
        stack: getStackByFiberInDevAndProd(source)
      };
    }
    var forkStack = [];
    var forkStackIndex = 0;
    var treeForkProvider = null;
    var treeForkCount = 0;
    var idStack = [];
    var idStackIndex = 0;
    var treeContextProvider = null;
    var treeContextId = 1;
    var treeContextOverflow = "";
    function pushTreeFork(workInProgress2, totalChildren) {
      forkStack[forkStackIndex++] = treeForkCount;
      forkStack[forkStackIndex++] = treeForkProvider;
      treeForkProvider = workInProgress2;
      treeForkCount = totalChildren;
    }
    function pushTreeId(workInProgress2, totalChildren, index2) {
      idStack[idStackIndex++] = treeContextId;
      idStack[idStackIndex++] = treeContextOverflow;
      idStack[idStackIndex++] = treeContextProvider;
      treeContextProvider = workInProgress2;
      var baseIdWithLeadingBit = treeContextId;
      workInProgress2 = treeContextOverflow;
      var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
      baseIdWithLeadingBit &= ~(1 << baseLength);
      index2 += 1;
      var length = 32 - clz32(totalChildren) + baseLength;
      if (30 < length) {
        var numberOfOverflowBits = baseLength - baseLength % 5;
        length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
        baseIdWithLeadingBit >>= numberOfOverflowBits;
        baseLength -= numberOfOverflowBits;
        treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
        treeContextOverflow = length + workInProgress2;
      } else
        treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress2;
    }
    function pushMaterializedTreeId(workInProgress2) {
      null !== workInProgress2.return && (pushTreeFork(workInProgress2, 1), pushTreeId(workInProgress2, 1, 0));
    }
    function popTreeContext(workInProgress2) {
      for (; workInProgress2 === treeForkProvider; )
        treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
      for (; workInProgress2 === treeContextProvider; )
        treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
    }
    function restoreSuspendedTreeContext(workInProgress2, suspendedContext) {
      idStack[idStackIndex++] = treeContextId;
      idStack[idStackIndex++] = treeContextOverflow;
      idStack[idStackIndex++] = treeContextProvider;
      treeContextId = suspendedContext.id;
      treeContextOverflow = suspendedContext.overflow;
      treeContextProvider = workInProgress2;
    }
    var hydrationParentFiber = null;
    var nextHydratableInstance = null;
    var isHydrating = false;
    var hydrationErrors = null;
    var rootOrSingletonContext = false;
    var HydrationMismatchException = Error(formatProdErrorMessage(519));
    function throwOnHydrationMismatch(fiber) {
      var error = Error(
        formatProdErrorMessage(
          418,
          1 < arguments.length && void 0 !== arguments[1] && arguments[1] ? "text" : "HTML",
          ""
        )
      );
      queueHydrationError(createCapturedValueAtFiber(error, fiber));
      throw HydrationMismatchException;
    }
    function prepareToHydrateHostInstance(fiber) {
      var instance = fiber.stateNode, type = fiber.type, props = fiber.memoizedProps;
      instance[internalInstanceKey] = fiber;
      instance[internalPropsKey] = props;
      switch (type) {
        case "dialog":
          listenToNonDelegatedEvent("cancel", instance);
          listenToNonDelegatedEvent("close", instance);
          break;
        case "iframe":
        case "object":
        case "embed":
          listenToNonDelegatedEvent("load", instance);
          break;
        case "video":
        case "audio":
          for (type = 0; type < mediaEventTypes.length; type++)
            listenToNonDelegatedEvent(mediaEventTypes[type], instance);
          break;
        case "source":
          listenToNonDelegatedEvent("error", instance);
          break;
        case "img":
        case "image":
        case "link":
          listenToNonDelegatedEvent("error", instance);
          listenToNonDelegatedEvent("load", instance);
          break;
        case "details":
          listenToNonDelegatedEvent("toggle", instance);
          break;
        case "input":
          listenToNonDelegatedEvent("invalid", instance);
          initInput(
            instance,
            props.value,
            props.defaultValue,
            props.checked,
            props.defaultChecked,
            props.type,
            props.name,
            true
          );
          break;
        case "select":
          listenToNonDelegatedEvent("invalid", instance);
          break;
        case "textarea":
          listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children);
      }
      type = props.children;
      "string" !== typeof type && "number" !== typeof type && "bigint" !== typeof type || instance.textContent === "" + type || true === props.suppressHydrationWarning || checkForUnmatchedText(instance.textContent, type) ? (null != props.popover && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), null != props.onScroll && listenToNonDelegatedEvent("scroll", instance), null != props.onScrollEnd && listenToNonDelegatedEvent("scrollend", instance), null != props.onClick && (instance.onclick = noop$1), instance = true) : instance = false;
      instance || throwOnHydrationMismatch(fiber, true);
    }
    function popToNextHostParent(fiber) {
      for (hydrationParentFiber = fiber.return; hydrationParentFiber; )
        switch (hydrationParentFiber.tag) {
          case 5:
          case 31:
          case 13:
            rootOrSingletonContext = false;
            return;
          case 27:
          case 3:
            rootOrSingletonContext = true;
            return;
          default:
            hydrationParentFiber = hydrationParentFiber.return;
        }
    }
    function popHydrationState(fiber) {
      if (fiber !== hydrationParentFiber) return false;
      if (!isHydrating) return popToNextHostParent(fiber), isHydrating = true, false;
      var tag = fiber.tag, JSCompiler_temp;
      if (JSCompiler_temp = 3 !== tag && 27 !== tag) {
        if (JSCompiler_temp = 5 === tag)
          JSCompiler_temp = fiber.type, JSCompiler_temp = !("form" !== JSCompiler_temp && "button" !== JSCompiler_temp) || shouldSetTextContent(fiber.type, fiber.memoizedProps);
        JSCompiler_temp = !JSCompiler_temp;
      }
      JSCompiler_temp && nextHydratableInstance && throwOnHydrationMismatch(fiber);
      popToNextHostParent(fiber);
      if (13 === tag) {
        fiber = fiber.memoizedState;
        fiber = null !== fiber ? fiber.dehydrated : null;
        if (!fiber) throw Error(formatProdErrorMessage(317));
        nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
      } else if (31 === tag) {
        fiber = fiber.memoizedState;
        fiber = null !== fiber ? fiber.dehydrated : null;
        if (!fiber) throw Error(formatProdErrorMessage(317));
        nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
      } else
        27 === tag ? (tag = nextHydratableInstance, isSingletonScope(fiber.type) ? (fiber = previousHydratableOnEnteringScopedSingleton, previousHydratableOnEnteringScopedSingleton = null, nextHydratableInstance = fiber) : nextHydratableInstance = tag) : nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
      return true;
    }
    function resetHydrationState() {
      nextHydratableInstance = hydrationParentFiber = null;
      isHydrating = false;
    }
    function upgradeHydrationErrorsToRecoverable() {
      var queuedErrors = hydrationErrors;
      null !== queuedErrors && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = queuedErrors : workInProgressRootRecoverableErrors.push.apply(
        workInProgressRootRecoverableErrors,
        queuedErrors
      ), hydrationErrors = null);
      return queuedErrors;
    }
    function queueHydrationError(error) {
      null === hydrationErrors ? hydrationErrors = [error] : hydrationErrors.push(error);
    }
    var valueCursor = createCursor(null);
    var currentlyRenderingFiber$1 = null;
    var lastContextDependency = null;
    function pushProvider(providerFiber, context, nextValue) {
      push(valueCursor, context._currentValue);
      context._currentValue = nextValue;
    }
    function popProvider(context) {
      context._currentValue = valueCursor.current;
      pop(valueCursor);
    }
    function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
      for (; null !== parent; ) {
        var alternate = parent.alternate;
        (parent.childLanes & renderLanes2) !== renderLanes2 ? (parent.childLanes |= renderLanes2, null !== alternate && (alternate.childLanes |= renderLanes2)) : null !== alternate && (alternate.childLanes & renderLanes2) !== renderLanes2 && (alternate.childLanes |= renderLanes2);
        if (parent === propagationRoot) break;
        parent = parent.return;
      }
    }
    function propagateContextChanges(workInProgress2, contexts, renderLanes2, forcePropagateEntireTree) {
      var fiber = workInProgress2.child;
      null !== fiber && (fiber.return = workInProgress2);
      for (; null !== fiber; ) {
        var list = fiber.dependencies;
        if (null !== list) {
          var nextFiber = fiber.child;
          list = list.firstContext;
          a: for (; null !== list; ) {
            var dependency = list;
            list = fiber;
            for (var i = 0; i < contexts.length; i++)
              if (dependency.context === contexts[i]) {
                list.lanes |= renderLanes2;
                dependency = list.alternate;
                null !== dependency && (dependency.lanes |= renderLanes2);
                scheduleContextWorkOnParentPath(
                  list.return,
                  renderLanes2,
                  workInProgress2
                );
                forcePropagateEntireTree || (nextFiber = null);
                break a;
              }
            list = dependency.next;
          }
        } else if (18 === fiber.tag) {
          nextFiber = fiber.return;
          if (null === nextFiber) throw Error(formatProdErrorMessage(341));
          nextFiber.lanes |= renderLanes2;
          list = nextFiber.alternate;
          null !== list && (list.lanes |= renderLanes2);
          scheduleContextWorkOnParentPath(nextFiber, renderLanes2, workInProgress2);
          nextFiber = null;
        } else nextFiber = fiber.child;
        if (null !== nextFiber) nextFiber.return = fiber;
        else
          for (nextFiber = fiber; null !== nextFiber; ) {
            if (nextFiber === workInProgress2) {
              nextFiber = null;
              break;
            }
            fiber = nextFiber.sibling;
            if (null !== fiber) {
              fiber.return = nextFiber.return;
              nextFiber = fiber;
              break;
            }
            nextFiber = nextFiber.return;
          }
        fiber = nextFiber;
      }
    }
    function propagateParentContextChanges(current2, workInProgress2, renderLanes2, forcePropagateEntireTree) {
      current2 = null;
      for (var parent = workInProgress2, isInsidePropagationBailout = false; null !== parent; ) {
        if (!isInsidePropagationBailout) {
          if (0 !== (parent.flags & 524288)) isInsidePropagationBailout = true;
          else if (0 !== (parent.flags & 262144)) break;
        }
        if (10 === parent.tag) {
          var currentParent = parent.alternate;
          if (null === currentParent) throw Error(formatProdErrorMessage(387));
          currentParent = currentParent.memoizedProps;
          if (null !== currentParent) {
            var context = parent.type;
            objectIs(parent.pendingProps.value, currentParent.value) || (null !== current2 ? current2.push(context) : current2 = [context]);
          }
        } else if (parent === hostTransitionProviderCursor.current) {
          currentParent = parent.alternate;
          if (null === currentParent) throw Error(formatProdErrorMessage(387));
          currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (null !== current2 ? current2.push(HostTransitionContext) : current2 = [HostTransitionContext]);
        }
        parent = parent.return;
      }
      null !== current2 && propagateContextChanges(
        workInProgress2,
        current2,
        renderLanes2,
        forcePropagateEntireTree
      );
      workInProgress2.flags |= 262144;
    }
    function checkIfContextChanged(currentDependencies) {
      for (currentDependencies = currentDependencies.firstContext; null !== currentDependencies; ) {
        if (!objectIs(
          currentDependencies.context._currentValue,
          currentDependencies.memoizedValue
        ))
          return true;
        currentDependencies = currentDependencies.next;
      }
      return false;
    }
    function prepareToReadContext(workInProgress2) {
      currentlyRenderingFiber$1 = workInProgress2;
      lastContextDependency = null;
      workInProgress2 = workInProgress2.dependencies;
      null !== workInProgress2 && (workInProgress2.firstContext = null);
    }
    function readContext(context) {
      return readContextForConsumer(currentlyRenderingFiber$1, context);
    }
    function readContextDuringReconciliation(consumer, context) {
      null === currentlyRenderingFiber$1 && prepareToReadContext(consumer);
      return readContextForConsumer(consumer, context);
    }
    function readContextForConsumer(consumer, context) {
      var value = context._currentValue;
      context = { context, memoizedValue: value, next: null };
      if (null === lastContextDependency) {
        if (null === consumer) throw Error(formatProdErrorMessage(308));
        lastContextDependency = context;
        consumer.dependencies = { lanes: 0, firstContext: context };
        consumer.flags |= 524288;
      } else lastContextDependency = lastContextDependency.next = context;
      return value;
    }
    var AbortControllerLocal = "undefined" !== typeof AbortController ? AbortController : function() {
      var listeners = [], signal = this.signal = {
        aborted: false,
        addEventListener: function(type, listener) {
          listeners.push(listener);
        }
      };
      this.abort = function() {
        signal.aborted = true;
        listeners.forEach(function(listener) {
          return listener();
        });
      };
    };
    var scheduleCallback$2 = Scheduler.unstable_scheduleCallback;
    var NormalPriority = Scheduler.unstable_NormalPriority;
    var CacheContext = {
      $$typeof: REACT_CONTEXT_TYPE,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0
    };
    function createCache() {
      return {
        controller: new AbortControllerLocal(),
        data: /* @__PURE__ */ new Map(),
        refCount: 0
      };
    }
    function releaseCache(cache) {
      cache.refCount--;
      0 === cache.refCount && scheduleCallback$2(NormalPriority, function() {
        cache.controller.abort();
      });
    }
    var currentEntangledListeners = null;
    var currentEntangledPendingCount = 0;
    var currentEntangledLane = 0;
    var currentEntangledActionThenable = null;
    function entangleAsyncAction(transition, thenable) {
      if (null === currentEntangledListeners) {
        var entangledListeners = currentEntangledListeners = [];
        currentEntangledPendingCount = 0;
        currentEntangledLane = requestTransitionLane();
        currentEntangledActionThenable = {
          status: "pending",
          value: void 0,
          then: function(resolve) {
            entangledListeners.push(resolve);
          }
        };
      }
      currentEntangledPendingCount++;
      thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
      return thenable;
    }
    function pingEngtangledActionScope() {
      if (0 === --currentEntangledPendingCount && null !== currentEntangledListeners) {
        null !== currentEntangledActionThenable && (currentEntangledActionThenable.status = "fulfilled");
        var listeners = currentEntangledListeners;
        currentEntangledListeners = null;
        currentEntangledLane = 0;
        currentEntangledActionThenable = null;
        for (var i = 0; i < listeners.length; i++) (0, listeners[i])();
      }
    }
    function chainThenableValue(thenable, result) {
      var listeners = [], thenableWithOverride = {
        status: "pending",
        value: null,
        reason: null,
        then: function(resolve) {
          listeners.push(resolve);
        }
      };
      thenable.then(
        function() {
          thenableWithOverride.status = "fulfilled";
          thenableWithOverride.value = result;
          for (var i = 0; i < listeners.length; i++) (0, listeners[i])(result);
        },
        function(error) {
          thenableWithOverride.status = "rejected";
          thenableWithOverride.reason = error;
          for (error = 0; error < listeners.length; error++)
            (0, listeners[error])(void 0);
        }
      );
      return thenableWithOverride;
    }
    var prevOnStartTransitionFinish = ReactSharedInternals.S;
    ReactSharedInternals.S = function(transition, returnValue) {
      globalMostRecentTransitionTime = now();
      "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && entangleAsyncAction(transition, returnValue);
      null !== prevOnStartTransitionFinish && prevOnStartTransitionFinish(transition, returnValue);
    };
    var resumedCache = createCursor(null);
    function peekCacheFromPool() {
      var cacheResumedFromPreviousRender = resumedCache.current;
      return null !== cacheResumedFromPreviousRender ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
    }
    function pushTransition(offscreenWorkInProgress, prevCachePool) {
      null === prevCachePool ? push(resumedCache, resumedCache.current) : push(resumedCache, prevCachePool.pool);
    }
    function getSuspendedCache() {
      var cacheFromPool = peekCacheFromPool();
      return null === cacheFromPool ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
    }
    var SuspenseException = Error(formatProdErrorMessage(460));
    var SuspenseyCommitException = Error(formatProdErrorMessage(474));
    var SuspenseActionException = Error(formatProdErrorMessage(542));
    var noopSuspenseyCommitThenable = { then: function() {
    } };
    function isThenableResolved(thenable) {
      thenable = thenable.status;
      return "fulfilled" === thenable || "rejected" === thenable;
    }
    function trackUsedThenable(thenableState2, thenable, index2) {
      index2 = thenableState2[index2];
      void 0 === index2 ? thenableState2.push(thenable) : index2 !== thenable && (thenable.then(noop$1, noop$1), thenable = index2);
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
        default:
          if ("string" === typeof thenable.status) thenable.then(noop$1, noop$1);
          else {
            thenableState2 = workInProgressRoot;
            if (null !== thenableState2 && 100 < thenableState2.shellSuspendCounter)
              throw Error(formatProdErrorMessage(482));
            thenableState2 = thenable;
            thenableState2.status = "pending";
            thenableState2.then(
              function(fulfilledValue) {
                if ("pending" === thenable.status) {
                  var fulfilledThenable = thenable;
                  fulfilledThenable.status = "fulfilled";
                  fulfilledThenable.value = fulfilledValue;
                }
              },
              function(error) {
                if ("pending" === thenable.status) {
                  var rejectedThenable = thenable;
                  rejectedThenable.status = "rejected";
                  rejectedThenable.reason = error;
                }
              }
            );
          }
          switch (thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
          }
          suspendedThenable = thenable;
          throw SuspenseException;
      }
    }
    function resolveLazy(lazyType) {
      try {
        var init = lazyType._init;
        return init(lazyType._payload);
      } catch (x) {
        if (null !== x && "object" === typeof x && "function" === typeof x.then)
          throw suspendedThenable = x, SuspenseException;
        throw x;
      }
    }
    var suspendedThenable = null;
    function getSuspendedThenable() {
      if (null === suspendedThenable) throw Error(formatProdErrorMessage(459));
      var thenable = suspendedThenable;
      suspendedThenable = null;
      return thenable;
    }
    function checkIfUseWrappedInAsyncCatch(rejectedReason) {
      if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException)
        throw Error(formatProdErrorMessage(483));
    }
    var thenableState$1 = null;
    var thenableIndexCounter$1 = 0;
    function unwrapThenable(thenable) {
      var index2 = thenableIndexCounter$1;
      thenableIndexCounter$1 += 1;
      null === thenableState$1 && (thenableState$1 = []);
      return trackUsedThenable(thenableState$1, thenable, index2);
    }
    function coerceRef(workInProgress2, element) {
      element = element.props.ref;
      workInProgress2.ref = void 0 !== element ? element : null;
    }
    function throwOnInvalidObjectTypeImpl(returnFiber, newChild) {
      if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
        throw Error(formatProdErrorMessage(525));
      returnFiber = Object.prototype.toString.call(newChild);
      throw Error(
        formatProdErrorMessage(
          31,
          "[object Object]" === returnFiber ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber
        )
      );
    }
    function createChildReconciler(shouldTrackSideEffects) {
      function deleteChild(returnFiber, childToDelete) {
        if (shouldTrackSideEffects) {
          var deletions = returnFiber.deletions;
          null === deletions ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
        }
      }
      function deleteRemainingChildren(returnFiber, currentFirstChild) {
        if (!shouldTrackSideEffects) return null;
        for (; null !== currentFirstChild; )
          deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
        return null;
      }
      function mapRemainingChildren(currentFirstChild) {
        for (var existingChildren = /* @__PURE__ */ new Map(); null !== currentFirstChild; )
          null !== currentFirstChild.key ? existingChildren.set(currentFirstChild.key, currentFirstChild) : existingChildren.set(currentFirstChild.index, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
        return existingChildren;
      }
      function useFiber(fiber, pendingProps) {
        fiber = createWorkInProgress(fiber, pendingProps);
        fiber.index = 0;
        fiber.sibling = null;
        return fiber;
      }
      function placeChild(newFiber, lastPlacedIndex, newIndex) {
        newFiber.index = newIndex;
        if (!shouldTrackSideEffects)
          return newFiber.flags |= 1048576, lastPlacedIndex;
        newIndex = newFiber.alternate;
        if (null !== newIndex)
          return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 67108866, lastPlacedIndex) : newIndex;
        newFiber.flags |= 67108866;
        return lastPlacedIndex;
      }
      function placeSingleChild(newFiber) {
        shouldTrackSideEffects && null === newFiber.alternate && (newFiber.flags |= 67108866);
        return newFiber;
      }
      function updateTextNode(returnFiber, current2, textContent, lanes) {
        if (null === current2 || 6 !== current2.tag)
          return current2 = createFiberFromText(textContent, returnFiber.mode, lanes), current2.return = returnFiber, current2;
        current2 = useFiber(current2, textContent);
        current2.return = returnFiber;
        return current2;
      }
      function updateElement(returnFiber, current2, element, lanes) {
        var elementType = element.type;
        if (elementType === REACT_FRAGMENT_TYPE)
          return updateFragment(
            returnFiber,
            current2,
            element.props.children,
            lanes,
            element.key
          );
        if (null !== current2 && (current2.elementType === elementType || "object" === typeof elementType && null !== elementType && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current2.type))
          return current2 = useFiber(current2, element.props), coerceRef(current2, element), current2.return = returnFiber, current2;
        current2 = createFiberFromTypeAndProps(
          element.type,
          element.key,
          element.props,
          null,
          returnFiber.mode,
          lanes
        );
        coerceRef(current2, element);
        current2.return = returnFiber;
        return current2;
      }
      function updatePortal(returnFiber, current2, portal, lanes) {
        if (null === current2 || 4 !== current2.tag || current2.stateNode.containerInfo !== portal.containerInfo || current2.stateNode.implementation !== portal.implementation)
          return current2 = createFiberFromPortal(portal, returnFiber.mode, lanes), current2.return = returnFiber, current2;
        current2 = useFiber(current2, portal.children || []);
        current2.return = returnFiber;
        return current2;
      }
      function updateFragment(returnFiber, current2, fragment, lanes, key) {
        if (null === current2 || 7 !== current2.tag)
          return current2 = createFiberFromFragment(
            fragment,
            returnFiber.mode,
            lanes,
            key
          ), current2.return = returnFiber, current2;
        current2 = useFiber(current2, fragment);
        current2.return = returnFiber;
        return current2;
      }
      function createChild(returnFiber, newChild, lanes) {
        if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
          return newChild = createFiberFromText(
            "" + newChild,
            returnFiber.mode,
            lanes
          ), newChild.return = returnFiber, newChild;
        if ("object" === typeof newChild && null !== newChild) {
          switch (newChild.$$typeof) {
            case REACT_ELEMENT_TYPE:
              return lanes = createFiberFromTypeAndProps(
                newChild.type,
                newChild.key,
                newChild.props,
                null,
                returnFiber.mode,
                lanes
              ), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
            case REACT_PORTAL_TYPE:
              return newChild = createFiberFromPortal(
                newChild,
                returnFiber.mode,
                lanes
              ), newChild.return = returnFiber, newChild;
            case REACT_LAZY_TYPE:
              return newChild = resolveLazy(newChild), createChild(returnFiber, newChild, lanes);
          }
          if (isArrayImpl(newChild) || getIteratorFn(newChild))
            return newChild = createFiberFromFragment(
              newChild,
              returnFiber.mode,
              lanes,
              null
            ), newChild.return = returnFiber, newChild;
          if ("function" === typeof newChild.then)
            return createChild(returnFiber, unwrapThenable(newChild), lanes);
          if (newChild.$$typeof === REACT_CONTEXT_TYPE)
            return createChild(
              returnFiber,
              readContextDuringReconciliation(returnFiber, newChild),
              lanes
            );
          throwOnInvalidObjectTypeImpl(returnFiber, newChild);
        }
        return null;
      }
      function updateSlot(returnFiber, oldFiber, newChild, lanes) {
        var key = null !== oldFiber ? oldFiber.key : null;
        if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
          return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
        if ("object" === typeof newChild && null !== newChild) {
          switch (newChild.$$typeof) {
            case REACT_ELEMENT_TYPE:
              return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
            case REACT_PORTAL_TYPE:
              return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
            case REACT_LAZY_TYPE:
              return newChild = resolveLazy(newChild), updateSlot(returnFiber, oldFiber, newChild, lanes);
          }
          if (isArrayImpl(newChild) || getIteratorFn(newChild))
            return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
          if ("function" === typeof newChild.then)
            return updateSlot(
              returnFiber,
              oldFiber,
              unwrapThenable(newChild),
              lanes
            );
          if (newChild.$$typeof === REACT_CONTEXT_TYPE)
            return updateSlot(
              returnFiber,
              oldFiber,
              readContextDuringReconciliation(returnFiber, newChild),
              lanes
            );
          throwOnInvalidObjectTypeImpl(returnFiber, newChild);
        }
        return null;
      }
      function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
        if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
          return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
        if ("object" === typeof newChild && null !== newChild) {
          switch (newChild.$$typeof) {
            case REACT_ELEMENT_TYPE:
              return existingChildren = existingChildren.get(
                null === newChild.key ? newIdx : newChild.key
              ) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
            case REACT_PORTAL_TYPE:
              return existingChildren = existingChildren.get(
                null === newChild.key ? newIdx : newChild.key
              ) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
            case REACT_LAZY_TYPE:
              return newChild = resolveLazy(newChild), updateFromMap(
                existingChildren,
                returnFiber,
                newIdx,
                newChild,
                lanes
              );
          }
          if (isArrayImpl(newChild) || getIteratorFn(newChild))
            return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
          if ("function" === typeof newChild.then)
            return updateFromMap(
              existingChildren,
              returnFiber,
              newIdx,
              unwrapThenable(newChild),
              lanes
            );
          if (newChild.$$typeof === REACT_CONTEXT_TYPE)
            return updateFromMap(
              existingChildren,
              returnFiber,
              newIdx,
              readContextDuringReconciliation(returnFiber, newChild),
              lanes
            );
          throwOnInvalidObjectTypeImpl(returnFiber, newChild);
        }
        return null;
      }
      function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
        for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
          oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
          var newFiber = updateSlot(
            returnFiber,
            oldFiber,
            newChildren[newIdx],
            lanes
          );
          if (null === newFiber) {
            null === oldFiber && (oldFiber = nextOldFiber);
            break;
          }
          shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
          currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
          null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
          previousNewFiber = newFiber;
          oldFiber = nextOldFiber;
        }
        if (newIdx === newChildren.length)
          return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
        if (null === oldFiber) {
          for (; newIdx < newChildren.length; newIdx++)
            oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), null !== oldFiber && (currentFirstChild = placeChild(
              oldFiber,
              currentFirstChild,
              newIdx
            ), null === previousNewFiber ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        for (oldFiber = mapRemainingChildren(oldFiber); newIdx < newChildren.length; newIdx++)
          nextOldFiber = updateFromMap(
            oldFiber,
            returnFiber,
            newIdx,
            newChildren[newIdx],
            lanes
          ), null !== nextOldFiber && (shouldTrackSideEffects && null !== nextOldFiber.alternate && oldFiber.delete(
            null === nextOldFiber.key ? newIdx : nextOldFiber.key
          ), currentFirstChild = placeChild(
            nextOldFiber,
            currentFirstChild,
            newIdx
          ), null === previousNewFiber ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
        shouldTrackSideEffects && oldFiber.forEach(function(child) {
          return deleteChild(returnFiber, child);
        });
        isHydrating && pushTreeFork(returnFiber, newIdx);
        return resultingFirstChild;
      }
      function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
        if (null == newChildren) throw Error(formatProdErrorMessage(151));
        for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, step = newChildren.next()) {
          oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
          var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
          if (null === newFiber) {
            null === oldFiber && (oldFiber = nextOldFiber);
            break;
          }
          shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
          currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
          null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
          previousNewFiber = newFiber;
          oldFiber = nextOldFiber;
        }
        if (step.done)
          return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
        if (null === oldFiber) {
          for (; !step.done; newIdx++, step = newChildren.next())
            step = createChild(returnFiber, step.value, lanes), null !== step && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
          isHydrating && pushTreeFork(returnFiber, newIdx);
          return resultingFirstChild;
        }
        for (oldFiber = mapRemainingChildren(oldFiber); !step.done; newIdx++, step = newChildren.next())
          step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), null !== step && (shouldTrackSideEffects && null !== step.alternate && oldFiber.delete(null === step.key ? newIdx : step.key), currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
        shouldTrackSideEffects && oldFiber.forEach(function(child) {
          return deleteChild(returnFiber, child);
        });
        isHydrating && pushTreeFork(returnFiber, newIdx);
        return resultingFirstChild;
      }
      function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
        "object" === typeof newChild && null !== newChild && newChild.type === REACT_FRAGMENT_TYPE && null === newChild.key && (newChild = newChild.props.children);
        if ("object" === typeof newChild && null !== newChild) {
          switch (newChild.$$typeof) {
            case REACT_ELEMENT_TYPE:
              a: {
                for (var key = newChild.key; null !== currentFirstChild; ) {
                  if (currentFirstChild.key === key) {
                    key = newChild.type;
                    if (key === REACT_FRAGMENT_TYPE) {
                      if (7 === currentFirstChild.tag) {
                        deleteRemainingChildren(
                          returnFiber,
                          currentFirstChild.sibling
                        );
                        lanes = useFiber(
                          currentFirstChild,
                          newChild.props.children
                        );
                        lanes.return = returnFiber;
                        returnFiber = lanes;
                        break a;
                      }
                    } else if (currentFirstChild.elementType === key || "object" === typeof key && null !== key && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                      deleteRemainingChildren(
                        returnFiber,
                        currentFirstChild.sibling
                      );
                      lanes = useFiber(currentFirstChild, newChild.props);
                      coerceRef(lanes, newChild);
                      lanes.return = returnFiber;
                      returnFiber = lanes;
                      break a;
                    }
                    deleteRemainingChildren(returnFiber, currentFirstChild);
                    break;
                  } else deleteChild(returnFiber, currentFirstChild);
                  currentFirstChild = currentFirstChild.sibling;
                }
                newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(
                  newChild.props.children,
                  returnFiber.mode,
                  lanes,
                  newChild.key
                ), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(
                  newChild.type,
                  newChild.key,
                  newChild.props,
                  null,
                  returnFiber.mode,
                  lanes
                ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
              }
              return placeSingleChild(returnFiber);
            case REACT_PORTAL_TYPE:
              a: {
                for (key = newChild.key; null !== currentFirstChild; ) {
                  if (currentFirstChild.key === key)
                    if (4 === currentFirstChild.tag && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                      deleteRemainingChildren(
                        returnFiber,
                        currentFirstChild.sibling
                      );
                      lanes = useFiber(currentFirstChild, newChild.children || []);
                      lanes.return = returnFiber;
                      returnFiber = lanes;
                      break a;
                    } else {
                      deleteRemainingChildren(returnFiber, currentFirstChild);
                      break;
                    }
                  else deleteChild(returnFiber, currentFirstChild);
                  currentFirstChild = currentFirstChild.sibling;
                }
                lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
                lanes.return = returnFiber;
                returnFiber = lanes;
              }
              return placeSingleChild(returnFiber);
            case REACT_LAZY_TYPE:
              return newChild = resolveLazy(newChild), reconcileChildFibersImpl(
                returnFiber,
                currentFirstChild,
                newChild,
                lanes
              );
          }
          if (isArrayImpl(newChild))
            return reconcileChildrenArray(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
          if (getIteratorFn(newChild)) {
            key = getIteratorFn(newChild);
            if ("function" !== typeof key) throw Error(formatProdErrorMessage(150));
            newChild = key.call(newChild);
            return reconcileChildrenIterator(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
          }
          if ("function" === typeof newChild.then)
            return reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              unwrapThenable(newChild),
              lanes
            );
          if (newChild.$$typeof === REACT_CONTEXT_TYPE)
            return reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              readContextDuringReconciliation(returnFiber, newChild),
              lanes
            );
          throwOnInvalidObjectTypeImpl(returnFiber, newChild);
        }
        return "string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild ? (newChild = "" + newChild, null !== currentFirstChild && 6 === currentFirstChild.tag ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
      }
      return function(returnFiber, currentFirstChild, newChild, lanes) {
        try {
          thenableIndexCounter$1 = 0;
          var firstChildFiber = reconcileChildFibersImpl(
            returnFiber,
            currentFirstChild,
            newChild,
            lanes
          );
          thenableState$1 = null;
          return firstChildFiber;
        } catch (x) {
          if (x === SuspenseException || x === SuspenseActionException) throw x;
          var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
          fiber.lanes = lanes;
          fiber.return = returnFiber;
          return fiber;
        } finally {
        }
      };
    }
    var reconcileChildFibers = createChildReconciler(true);
    var mountChildFibers = createChildReconciler(false);
    var hasForceUpdate = false;
    function initializeUpdateQueue(fiber) {
      fiber.updateQueue = {
        baseState: fiber.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: { pending: null, lanes: 0, hiddenCallbacks: null },
        callbacks: null
      };
    }
    function cloneUpdateQueue(current2, workInProgress2) {
      current2 = current2.updateQueue;
      workInProgress2.updateQueue === current2 && (workInProgress2.updateQueue = {
        baseState: current2.baseState,
        firstBaseUpdate: current2.firstBaseUpdate,
        lastBaseUpdate: current2.lastBaseUpdate,
        shared: current2.shared,
        callbacks: null
      });
    }
    function createUpdate(lane) {
      return { lane, tag: 0, payload: null, callback: null, next: null };
    }
    function enqueueUpdate(fiber, update, lane) {
      var updateQueue = fiber.updateQueue;
      if (null === updateQueue) return null;
      updateQueue = updateQueue.shared;
      if (0 !== (executionContext & 2)) {
        var pending = updateQueue.pending;
        null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
        updateQueue.pending = update;
        update = getRootForUpdatedFiber(fiber);
        markUpdateLaneFromFiberToRoot(fiber, null, lane);
        return update;
      }
      enqueueUpdate$1(fiber, updateQueue, update, lane);
      return getRootForUpdatedFiber(fiber);
    }
    function entangleTransitions(root2, fiber, lane) {
      fiber = fiber.updateQueue;
      if (null !== fiber && (fiber = fiber.shared, 0 !== (lane & 4194048))) {
        var queueLanes = fiber.lanes;
        queueLanes &= root2.pendingLanes;
        lane |= queueLanes;
        fiber.lanes = lane;
        markRootEntangled(root2, lane);
      }
    }
    function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
      var queue = workInProgress2.updateQueue, current2 = workInProgress2.alternate;
      if (null !== current2 && (current2 = current2.updateQueue, queue === current2)) {
        var newFirst = null, newLast = null;
        queue = queue.firstBaseUpdate;
        if (null !== queue) {
          do {
            var clone = {
              lane: queue.lane,
              tag: queue.tag,
              payload: queue.payload,
              callback: null,
              next: null
            };
            null === newLast ? newFirst = newLast = clone : newLast = newLast.next = clone;
            queue = queue.next;
          } while (null !== queue);
          null === newLast ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
        } else newFirst = newLast = capturedUpdate;
        queue = {
          baseState: current2.baseState,
          firstBaseUpdate: newFirst,
          lastBaseUpdate: newLast,
          shared: current2.shared,
          callbacks: current2.callbacks
        };
        workInProgress2.updateQueue = queue;
        return;
      }
      workInProgress2 = queue.lastBaseUpdate;
      null === workInProgress2 ? queue.firstBaseUpdate = capturedUpdate : workInProgress2.next = capturedUpdate;
      queue.lastBaseUpdate = capturedUpdate;
    }
    var didReadFromEntangledAsyncAction = false;
    function suspendIfUpdateReadFromEntangledAsyncAction() {
      if (didReadFromEntangledAsyncAction) {
        var entangledActionThenable = currentEntangledActionThenable;
        if (null !== entangledActionThenable) throw entangledActionThenable;
      }
    }
    function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes2) {
      didReadFromEntangledAsyncAction = false;
      var queue = workInProgress$jscomp$0.updateQueue;
      hasForceUpdate = false;
      var firstBaseUpdate = queue.firstBaseUpdate, lastBaseUpdate = queue.lastBaseUpdate, pendingQueue = queue.shared.pending;
      if (null !== pendingQueue) {
        queue.shared.pending = null;
        var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
        lastPendingUpdate.next = null;
        null === lastBaseUpdate ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
        lastBaseUpdate = lastPendingUpdate;
        var current2 = workInProgress$jscomp$0.alternate;
        null !== current2 && (current2 = current2.updateQueue, pendingQueue = current2.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (null === pendingQueue ? current2.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current2.lastBaseUpdate = lastPendingUpdate));
      }
      if (null !== firstBaseUpdate) {
        var newState = queue.baseState;
        lastBaseUpdate = 0;
        current2 = firstPendingUpdate = lastPendingUpdate = null;
        pendingQueue = firstBaseUpdate;
        do {
          var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
          if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes2 & updateLane) === updateLane) {
            0 !== updateLane && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
            null !== current2 && (current2 = current2.next = {
              lane: 0,
              tag: pendingQueue.tag,
              payload: pendingQueue.payload,
              callback: null,
              next: null
            });
            a: {
              var workInProgress2 = workInProgress$jscomp$0, update = pendingQueue;
              updateLane = props;
              var instance = instance$jscomp$0;
              switch (update.tag) {
                case 1:
                  workInProgress2 = update.payload;
                  if ("function" === typeof workInProgress2) {
                    newState = workInProgress2.call(instance, newState, updateLane);
                    break a;
                  }
                  newState = workInProgress2;
                  break a;
                case 3:
                  workInProgress2.flags = workInProgress2.flags & -65537 | 128;
                case 0:
                  workInProgress2 = update.payload;
                  updateLane = "function" === typeof workInProgress2 ? workInProgress2.call(instance, newState, updateLane) : workInProgress2;
                  if (null === updateLane || void 0 === updateLane) break a;
                  newState = assign({}, newState, updateLane);
                  break a;
                case 2:
                  hasForceUpdate = true;
              }
            }
            updateLane = pendingQueue.callback;
            null !== updateLane && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, null === isHiddenUpdate ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
          } else
            isHiddenUpdate = {
              lane: updateLane,
              tag: pendingQueue.tag,
              payload: pendingQueue.payload,
              callback: pendingQueue.callback,
              next: null
            }, null === current2 ? (firstPendingUpdate = current2 = isHiddenUpdate, lastPendingUpdate = newState) : current2 = current2.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
          pendingQueue = pendingQueue.next;
          if (null === pendingQueue)
            if (pendingQueue = queue.shared.pending, null === pendingQueue)
              break;
            else
              isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
        } while (1);
        null === current2 && (lastPendingUpdate = newState);
        queue.baseState = lastPendingUpdate;
        queue.firstBaseUpdate = firstPendingUpdate;
        queue.lastBaseUpdate = current2;
        null === firstBaseUpdate && (queue.shared.lanes = 0);
        workInProgressRootSkippedLanes |= lastBaseUpdate;
        workInProgress$jscomp$0.lanes = lastBaseUpdate;
        workInProgress$jscomp$0.memoizedState = newState;
      }
    }
    function callCallback(callback, context) {
      if ("function" !== typeof callback)
        throw Error(formatProdErrorMessage(191, callback));
      callback.call(context);
    }
    function commitCallbacks(updateQueue, context) {
      var callbacks = updateQueue.callbacks;
      if (null !== callbacks)
        for (updateQueue.callbacks = null, updateQueue = 0; updateQueue < callbacks.length; updateQueue++)
          callCallback(callbacks[updateQueue], context);
    }
    var currentTreeHiddenStackCursor = createCursor(null);
    var prevEntangledRenderLanesCursor = createCursor(0);
    function pushHiddenContext(fiber, context) {
      fiber = entangledRenderLanes;
      push(prevEntangledRenderLanesCursor, fiber);
      push(currentTreeHiddenStackCursor, context);
      entangledRenderLanes = fiber | context.baseLanes;
    }
    function reuseHiddenContextOnStack() {
      push(prevEntangledRenderLanesCursor, entangledRenderLanes);
      push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
    }
    function popHiddenContext() {
      entangledRenderLanes = prevEntangledRenderLanesCursor.current;
      pop(currentTreeHiddenStackCursor);
      pop(prevEntangledRenderLanesCursor);
    }
    var suspenseHandlerStackCursor = createCursor(null);
    var shellBoundary = null;
    function pushPrimaryTreeSuspenseHandler(handler) {
      var current2 = handler.alternate;
      push(suspenseStackCursor, suspenseStackCursor.current & 1);
      push(suspenseHandlerStackCursor, handler);
      null === shellBoundary && (null === current2 || null !== currentTreeHiddenStackCursor.current ? shellBoundary = handler : null !== current2.memoizedState && (shellBoundary = handler));
    }
    function pushDehydratedActivitySuspenseHandler(fiber) {
      push(suspenseStackCursor, suspenseStackCursor.current);
      push(suspenseHandlerStackCursor, fiber);
      null === shellBoundary && (shellBoundary = fiber);
    }
    function pushOffscreenSuspenseHandler(fiber) {
      22 === fiber.tag ? (push(suspenseStackCursor, suspenseStackCursor.current), push(suspenseHandlerStackCursor, fiber), null === shellBoundary && (shellBoundary = fiber)) : reuseSuspenseHandlerOnStack(fiber);
    }
    function reuseSuspenseHandlerOnStack() {
      push(suspenseStackCursor, suspenseStackCursor.current);
      push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
    }
    function popSuspenseHandler(fiber) {
      pop(suspenseHandlerStackCursor);
      shellBoundary === fiber && (shellBoundary = null);
      pop(suspenseStackCursor);
    }
    var suspenseStackCursor = createCursor(0);
    function findFirstSuspended(row) {
      for (var node = row; null !== node; ) {
        if (13 === node.tag) {
          var state = node.memoizedState;
          if (null !== state && (state = state.dehydrated, null === state || isSuspenseInstancePending(state) || isSuspenseInstanceFallback(state)))
            return node;
        } else if (19 === node.tag && ("forwards" === node.memoizedProps.revealOrder || "backwards" === node.memoizedProps.revealOrder || "unstable_legacy-backwards" === node.memoizedProps.revealOrder || "together" === node.memoizedProps.revealOrder)) {
          if (0 !== (node.flags & 128)) return node;
        } else if (null !== node.child) {
          node.child.return = node;
          node = node.child;
          continue;
        }
        if (node === row) break;
        for (; null === node.sibling; ) {
          if (null === node.return || node.return === row) return null;
          node = node.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
      }
      return null;
    }
    var renderLanes = 0;
    var currentlyRenderingFiber = null;
    var currentHook = null;
    var workInProgressHook = null;
    var didScheduleRenderPhaseUpdate = false;
    var didScheduleRenderPhaseUpdateDuringThisPass = false;
    var shouldDoubleInvokeUserFnsInHooksDEV = false;
    var localIdCounter = 0;
    var thenableIndexCounter = 0;
    var thenableState = null;
    var globalClientIdCounter = 0;
    function throwInvalidHookError() {
      throw Error(formatProdErrorMessage(321));
    }
    function areHookInputsEqual(nextDeps, prevDeps) {
      if (null === prevDeps) return false;
      for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++)
        if (!objectIs(nextDeps[i], prevDeps[i])) return false;
      return true;
    }
    function renderWithHooks(current2, workInProgress2, Component, props, secondArg, nextRenderLanes) {
      renderLanes = nextRenderLanes;
      currentlyRenderingFiber = workInProgress2;
      workInProgress2.memoizedState = null;
      workInProgress2.updateQueue = null;
      workInProgress2.lanes = 0;
      ReactSharedInternals.H = null === current2 || null === current2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
      shouldDoubleInvokeUserFnsInHooksDEV = false;
      nextRenderLanes = Component(props, secondArg);
      shouldDoubleInvokeUserFnsInHooksDEV = false;
      didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(
        workInProgress2,
        Component,
        props,
        secondArg
      ));
      finishRenderingHooks(current2);
      return nextRenderLanes;
    }
    function finishRenderingHooks(current2) {
      ReactSharedInternals.H = ContextOnlyDispatcher;
      var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
      renderLanes = 0;
      workInProgressHook = currentHook = currentlyRenderingFiber = null;
      didScheduleRenderPhaseUpdate = false;
      thenableIndexCounter = 0;
      thenableState = null;
      if (didRenderTooFewHooks) throw Error(formatProdErrorMessage(300));
      null === current2 || didReceiveUpdate || (current2 = current2.dependencies, null !== current2 && checkIfContextChanged(current2) && (didReceiveUpdate = true));
    }
    function renderWithHooksAgain(workInProgress2, Component, props, secondArg) {
      currentlyRenderingFiber = workInProgress2;
      var numberOfReRenders = 0;
      do {
        didScheduleRenderPhaseUpdateDuringThisPass && (thenableState = null);
        thenableIndexCounter = 0;
        didScheduleRenderPhaseUpdateDuringThisPass = false;
        if (25 <= numberOfReRenders) throw Error(formatProdErrorMessage(301));
        numberOfReRenders += 1;
        workInProgressHook = currentHook = null;
        if (null != workInProgress2.updateQueue) {
          var children = workInProgress2.updateQueue;
          children.lastEffect = null;
          children.events = null;
          children.stores = null;
          null != children.memoCache && (children.memoCache.index = 0);
        }
        ReactSharedInternals.H = HooksDispatcherOnRerender;
        children = Component(props, secondArg);
      } while (didScheduleRenderPhaseUpdateDuringThisPass);
      return children;
    }
    function TransitionAwareHostComponent() {
      var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
      maybeThenable = "function" === typeof maybeThenable.then ? useThenable(maybeThenable) : maybeThenable;
      dispatcher = dispatcher.useState()[0];
      (null !== currentHook ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber.flags |= 1024);
      return maybeThenable;
    }
    function checkDidRenderIdHook() {
      var didRenderIdHook = 0 !== localIdCounter;
      localIdCounter = 0;
      return didRenderIdHook;
    }
    function bailoutHooks(current2, workInProgress2, lanes) {
      workInProgress2.updateQueue = current2.updateQueue;
      workInProgress2.flags &= -2053;
      current2.lanes &= ~lanes;
    }
    function resetHooksOnUnwind(workInProgress2) {
      if (didScheduleRenderPhaseUpdate) {
        for (workInProgress2 = workInProgress2.memoizedState; null !== workInProgress2; ) {
          var queue = workInProgress2.queue;
          null !== queue && (queue.pending = null);
          workInProgress2 = workInProgress2.next;
        }
        didScheduleRenderPhaseUpdate = false;
      }
      renderLanes = 0;
      workInProgressHook = currentHook = currentlyRenderingFiber = null;
      didScheduleRenderPhaseUpdateDuringThisPass = false;
      thenableIndexCounter = localIdCounter = 0;
      thenableState = null;
    }
    function mountWorkInProgressHook() {
      var hook = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
      };
      null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
      return workInProgressHook;
    }
    function updateWorkInProgressHook() {
      if (null === currentHook) {
        var nextCurrentHook = currentlyRenderingFiber.alternate;
        nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
      } else nextCurrentHook = currentHook.next;
      var nextWorkInProgressHook = null === workInProgressHook ? currentlyRenderingFiber.memoizedState : workInProgressHook.next;
      if (null !== nextWorkInProgressHook)
        workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
      else {
        if (null === nextCurrentHook) {
          if (null === currentlyRenderingFiber.alternate)
            throw Error(formatProdErrorMessage(467));
          throw Error(formatProdErrorMessage(310));
        }
        currentHook = nextCurrentHook;
        nextCurrentHook = {
          memoizedState: currentHook.memoizedState,
          baseState: currentHook.baseState,
          baseQueue: currentHook.baseQueue,
          queue: currentHook.queue,
          next: null
        };
        null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
      }
      return workInProgressHook;
    }
    function createFunctionComponentUpdateQueue() {
      return { lastEffect: null, events: null, stores: null, memoCache: null };
    }
    function useThenable(thenable) {
      var index2 = thenableIndexCounter;
      thenableIndexCounter += 1;
      null === thenableState && (thenableState = []);
      thenable = trackUsedThenable(thenableState, thenable, index2);
      index2 = currentlyRenderingFiber;
      null === (null === workInProgressHook ? index2.memoizedState : workInProgressHook.next) && (index2 = index2.alternate, ReactSharedInternals.H = null === index2 || null === index2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
      return thenable;
    }
    function use(usable) {
      if (null !== usable && "object" === typeof usable) {
        if ("function" === typeof usable.then) return useThenable(usable);
        if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
      }
      throw Error(formatProdErrorMessage(438, String(usable)));
    }
    function useMemoCache(size) {
      var memoCache = null, updateQueue = currentlyRenderingFiber.updateQueue;
      null !== updateQueue && (memoCache = updateQueue.memoCache);
      if (null == memoCache) {
        var current2 = currentlyRenderingFiber.alternate;
        null !== current2 && (current2 = current2.updateQueue, null !== current2 && (current2 = current2.memoCache, null != current2 && (memoCache = {
          data: current2.data.map(function(array) {
            return array.slice();
          }),
          index: 0
        })));
      }
      null == memoCache && (memoCache = { data: [], index: 0 });
      null === updateQueue && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = updateQueue);
      updateQueue.memoCache = memoCache;
      updateQueue = memoCache.data[memoCache.index];
      if (void 0 === updateQueue)
        for (updateQueue = memoCache.data[memoCache.index] = Array(size), current2 = 0; current2 < size; current2++)
          updateQueue[current2] = REACT_MEMO_CACHE_SENTINEL;
      memoCache.index++;
      return updateQueue;
    }
    function basicStateReducer(state, action) {
      return "function" === typeof action ? action(state) : action;
    }
    function updateReducer(reducer) {
      var hook = updateWorkInProgressHook();
      return updateReducerImpl(hook, currentHook, reducer);
    }
    function updateReducerImpl(hook, current2, reducer) {
      var queue = hook.queue;
      if (null === queue) throw Error(formatProdErrorMessage(311));
      queue.lastRenderedReducer = reducer;
      var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
      if (null !== pendingQueue) {
        if (null !== baseQueue) {
          var baseFirst = baseQueue.next;
          baseQueue.next = pendingQueue.next;
          pendingQueue.next = baseFirst;
        }
        current2.baseQueue = baseQueue = pendingQueue;
        queue.pending = null;
      }
      pendingQueue = hook.baseState;
      if (null === baseQueue) hook.memoizedState = pendingQueue;
      else {
        current2 = baseQueue.next;
        var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update = current2, didReadFromEntangledAsyncAction$60 = false;
        do {
          var updateLane = update.lane & -536870913;
          if (updateLane !== update.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
            var revertLane = update.revertLane;
            if (0 === revertLane)
              null !== newBaseQueueLast && (newBaseQueueLast = newBaseQueueLast.next = {
                lane: 0,
                revertLane: 0,
                gesture: null,
                action: update.action,
                hasEagerState: update.hasEagerState,
                eagerState: update.eagerState,
                next: null
              }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$60 = true);
            else if ((renderLanes & revertLane) === revertLane) {
              update = update.next;
              revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$60 = true);
              continue;
            } else
              updateLane = {
                lane: 0,
                revertLane: update.revertLane,
                gesture: null,
                action: update.action,
                hasEagerState: update.hasEagerState,
                eagerState: update.eagerState,
                next: null
              }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
            updateLane = update.action;
            shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
            pendingQueue = update.hasEagerState ? update.eagerState : reducer(pendingQueue, updateLane);
          } else
            revertLane = {
              lane: updateLane,
              revertLane: update.revertLane,
              gesture: update.gesture,
              action: update.action,
              hasEagerState: update.hasEagerState,
              eagerState: update.eagerState,
              next: null
            }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
          update = update.next;
        } while (null !== update && update !== current2);
        null === newBaseQueueLast ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
        if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$60 && (reducer = currentEntangledActionThenable, null !== reducer)))
          throw reducer;
        hook.memoizedState = pendingQueue;
        hook.baseState = baseFirst;
        hook.baseQueue = newBaseQueueLast;
        queue.lastRenderedState = pendingQueue;
      }
      null === baseQueue && (queue.lanes = 0);
      return [hook.memoizedState, queue.dispatch];
    }
    function rerenderReducer(reducer) {
      var hook = updateWorkInProgressHook(), queue = hook.queue;
      if (null === queue) throw Error(formatProdErrorMessage(311));
      queue.lastRenderedReducer = reducer;
      var dispatch = queue.dispatch, lastRenderPhaseUpdate = queue.pending, newState = hook.memoizedState;
      if (null !== lastRenderPhaseUpdate) {
        queue.pending = null;
        var update = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
        do
          newState = reducer(newState, update.action), update = update.next;
        while (update !== lastRenderPhaseUpdate);
        objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
        hook.memoizedState = newState;
        null === hook.baseQueue && (hook.baseState = newState);
        queue.lastRenderedState = newState;
      }
      return [newState, dispatch];
    }
    function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
      var fiber = currentlyRenderingFiber, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
      if (isHydrating$jscomp$0) {
        if (void 0 === getServerSnapshot) throw Error(formatProdErrorMessage(407));
        getServerSnapshot = getServerSnapshot();
      } else getServerSnapshot = getSnapshot();
      var snapshotChanged = !objectIs(
        (currentHook || hook).memoizedState,
        getServerSnapshot
      );
      snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
      hook = hook.queue;
      updateEffect(subscribeToStore.bind(null, fiber, hook, subscribe), [
        subscribe
      ]);
      if (hook.getSnapshot !== getSnapshot || snapshotChanged || null !== workInProgressHook && workInProgressHook.memoizedState.tag & 1) {
        fiber.flags |= 2048;
        pushSimpleEffect(
          9,
          { destroy: void 0 },
          updateStoreInstance.bind(
            null,
            fiber,
            hook,
            getServerSnapshot,
            getSnapshot
          ),
          null
        );
        if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
        isHydrating$jscomp$0 || 0 !== (renderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
      }
      return getServerSnapshot;
    }
    function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
      fiber.flags |= 16384;
      fiber = { getSnapshot, value: renderedSnapshot };
      getSnapshot = currentlyRenderingFiber.updateQueue;
      null === getSnapshot ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, null === renderedSnapshot ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
    }
    function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
      inst.value = nextSnapshot;
      inst.getSnapshot = getSnapshot;
      checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
    }
    function subscribeToStore(fiber, inst, subscribe) {
      return subscribe(function() {
        checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
      });
    }
    function checkIfSnapshotChanged(inst) {
      var latestGetSnapshot = inst.getSnapshot;
      inst = inst.value;
      try {
        var nextValue = latestGetSnapshot();
        return !objectIs(inst, nextValue);
      } catch (error) {
        return true;
      }
    }
    function forceStoreRerender(fiber) {
      var root2 = enqueueConcurrentRenderForLane(fiber, 2);
      null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2);
    }
    function mountStateImpl(initialState) {
      var hook = mountWorkInProgressHook();
      if ("function" === typeof initialState) {
        var initialStateInitializer = initialState;
        initialState = initialStateInitializer();
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            initialStateInitializer();
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
      }
      hook.memoizedState = hook.baseState = initialState;
      hook.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: basicStateReducer,
        lastRenderedState: initialState
      };
      return hook;
    }
    function updateOptimisticImpl(hook, current2, passthrough, reducer) {
      hook.baseState = passthrough;
      return updateReducerImpl(
        hook,
        currentHook,
        "function" === typeof reducer ? reducer : basicStateReducer
      );
    }
    function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
      if (isRenderPhaseUpdate(fiber)) throw Error(formatProdErrorMessage(485));
      fiber = actionQueue.action;
      if (null !== fiber) {
        var actionNode = {
          payload,
          action: fiber,
          next: null,
          isTransition: true,
          status: "pending",
          value: null,
          reason: null,
          listeners: [],
          then: function(listener) {
            actionNode.listeners.push(listener);
          }
        };
        null !== ReactSharedInternals.T ? setPendingState(true) : actionNode.isTransition = false;
        setState(actionNode);
        setPendingState = actionQueue.pending;
        null === setPendingState ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
      }
    }
    function runActionStateAction(actionQueue, node) {
      var action = node.action, payload = node.payload, prevState = actionQueue.state;
      if (node.isTransition) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          handleActionReturnValue(actionQueue, node, returnValue);
        } catch (error) {
          onActionError(actionQueue, node, error);
        } finally {
          null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      } else
        try {
          prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
        } catch (error$66) {
          onActionError(actionQueue, node, error$66);
        }
    }
    function handleActionReturnValue(actionQueue, node, returnValue) {
      null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then ? returnValue.then(
        function(nextState) {
          onActionSuccess(actionQueue, node, nextState);
        },
        function(error) {
          return onActionError(actionQueue, node, error);
        }
      ) : onActionSuccess(actionQueue, node, returnValue);
    }
    function onActionSuccess(actionQueue, actionNode, nextState) {
      actionNode.status = "fulfilled";
      actionNode.value = nextState;
      notifyActionListeners(actionNode);
      actionQueue.state = nextState;
      actionNode = actionQueue.pending;
      null !== actionNode && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
    }
    function onActionError(actionQueue, actionNode, error) {
      var last = actionQueue.pending;
      actionQueue.pending = null;
      if (null !== last) {
        last = last.next;
        do
          actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
        while (actionNode !== last);
      }
      actionQueue.action = null;
    }
    function notifyActionListeners(actionNode) {
      actionNode = actionNode.listeners;
      for (var i = 0; i < actionNode.length; i++) (0, actionNode[i])();
    }
    function actionStateReducer(oldState, newState) {
      return newState;
    }
    function mountActionState(action, initialStateProp) {
      if (isHydrating) {
        var ssrFormState = workInProgressRoot.formState;
        if (null !== ssrFormState) {
          a: {
            var JSCompiler_inline_result = currentlyRenderingFiber;
            if (isHydrating) {
              if (nextHydratableInstance) {
                b: {
                  var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
                  for (var inRootOrSingleton = rootOrSingletonContext; 8 !== JSCompiler_inline_result$jscomp$0.nodeType; ) {
                    if (!inRootOrSingleton) {
                      JSCompiler_inline_result$jscomp$0 = null;
                      break b;
                    }
                    JSCompiler_inline_result$jscomp$0 = getNextHydratable(
                      JSCompiler_inline_result$jscomp$0.nextSibling
                    );
                    if (null === JSCompiler_inline_result$jscomp$0) {
                      JSCompiler_inline_result$jscomp$0 = null;
                      break b;
                    }
                  }
                  inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
                  JSCompiler_inline_result$jscomp$0 = "F!" === inRootOrSingleton || "F" === inRootOrSingleton ? JSCompiler_inline_result$jscomp$0 : null;
                }
                if (JSCompiler_inline_result$jscomp$0) {
                  nextHydratableInstance = getNextHydratable(
                    JSCompiler_inline_result$jscomp$0.nextSibling
                  );
                  JSCompiler_inline_result = "F!" === JSCompiler_inline_result$jscomp$0.data;
                  break a;
                }
              }
              throwOnHydrationMismatch(JSCompiler_inline_result);
            }
            JSCompiler_inline_result = false;
          }
          JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
        }
      }
      ssrFormState = mountWorkInProgressHook();
      ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
      JSCompiler_inline_result = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: actionStateReducer,
        lastRenderedState: initialStateProp
      };
      ssrFormState.queue = JSCompiler_inline_result;
      ssrFormState = dispatchSetState.bind(
        null,
        currentlyRenderingFiber,
        JSCompiler_inline_result
      );
      JSCompiler_inline_result.dispatch = ssrFormState;
      JSCompiler_inline_result = mountStateImpl(false);
      inRootOrSingleton = dispatchOptimisticSetState.bind(
        null,
        currentlyRenderingFiber,
        false,
        JSCompiler_inline_result.queue
      );
      JSCompiler_inline_result = mountWorkInProgressHook();
      JSCompiler_inline_result$jscomp$0 = {
        state: initialStateProp,
        dispatch: null,
        action,
        pending: null
      };
      JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
      ssrFormState = dispatchActionState.bind(
        null,
        currentlyRenderingFiber,
        JSCompiler_inline_result$jscomp$0,
        inRootOrSingleton,
        ssrFormState
      );
      JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
      JSCompiler_inline_result.memoizedState = action;
      return [initialStateProp, ssrFormState, false];
    }
    function updateActionState(action) {
      var stateHook = updateWorkInProgressHook();
      return updateActionStateImpl(stateHook, currentHook, action);
    }
    function updateActionStateImpl(stateHook, currentStateHook, action) {
      currentStateHook = updateReducerImpl(
        stateHook,
        currentStateHook,
        actionStateReducer
      )[0];
      stateHook = updateReducer(basicStateReducer)[0];
      if ("object" === typeof currentStateHook && null !== currentStateHook && "function" === typeof currentStateHook.then)
        try {
          var state = useThenable(currentStateHook);
        } catch (x) {
          if (x === SuspenseException) throw SuspenseActionException;
          throw x;
        }
      else state = currentStateHook;
      currentStateHook = updateWorkInProgressHook();
      var actionQueue = currentStateHook.queue, dispatch = actionQueue.dispatch;
      action !== currentStateHook.memoizedState && (currentlyRenderingFiber.flags |= 2048, pushSimpleEffect(
        9,
        { destroy: void 0 },
        actionStateActionEffect.bind(null, actionQueue, action),
        null
      ));
      return [state, dispatch, stateHook];
    }
    function actionStateActionEffect(actionQueue, action) {
      actionQueue.action = action;
    }
    function rerenderActionState(action) {
      var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
      if (null !== currentStateHook)
        return updateActionStateImpl(stateHook, currentStateHook, action);
      updateWorkInProgressHook();
      stateHook = stateHook.memoizedState;
      currentStateHook = updateWorkInProgressHook();
      var dispatch = currentStateHook.queue.dispatch;
      currentStateHook.memoizedState = action;
      return [stateHook, dispatch, false];
    }
    function pushSimpleEffect(tag, inst, create2, deps) {
      tag = { tag, create: create2, deps, inst, next: null };
      inst = currentlyRenderingFiber.updateQueue;
      null === inst && (inst = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = inst);
      create2 = inst.lastEffect;
      null === create2 ? inst.lastEffect = tag.next = tag : (deps = create2.next, create2.next = tag, tag.next = deps, inst.lastEffect = tag);
      return tag;
    }
    function updateRef() {
      return updateWorkInProgressHook().memoizedState;
    }
    function mountEffectImpl(fiberFlags, hookFlags, create2, deps) {
      var hook = mountWorkInProgressHook();
      currentlyRenderingFiber.flags |= fiberFlags;
      hook.memoizedState = pushSimpleEffect(
        1 | hookFlags,
        { destroy: void 0 },
        create2,
        void 0 === deps ? null : deps
      );
    }
    function updateEffectImpl(fiberFlags, hookFlags, create2, deps) {
      var hook = updateWorkInProgressHook();
      deps = void 0 === deps ? null : deps;
      var inst = hook.memoizedState.inst;
      null !== currentHook && null !== deps && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushSimpleEffect(hookFlags, inst, create2, deps) : (currentlyRenderingFiber.flags |= fiberFlags, hook.memoizedState = pushSimpleEffect(
        1 | hookFlags,
        inst,
        create2,
        deps
      ));
    }
    function mountEffect(create2, deps) {
      mountEffectImpl(8390656, 8, create2, deps);
    }
    function updateEffect(create2, deps) {
      updateEffectImpl(2048, 8, create2, deps);
    }
    function useEffectEventImpl(payload) {
      currentlyRenderingFiber.flags |= 4;
      var componentUpdateQueue = currentlyRenderingFiber.updateQueue;
      if (null === componentUpdateQueue)
        componentUpdateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = componentUpdateQueue, componentUpdateQueue.events = [payload];
      else {
        var events = componentUpdateQueue.events;
        null === events ? componentUpdateQueue.events = [payload] : events.push(payload);
      }
    }
    function updateEvent(callback) {
      var ref = updateWorkInProgressHook().memoizedState;
      useEffectEventImpl({ ref, nextImpl: callback });
      return function() {
        if (0 !== (executionContext & 2)) throw Error(formatProdErrorMessage(440));
        return ref.impl.apply(void 0, arguments);
      };
    }
    function updateInsertionEffect(create2, deps) {
      return updateEffectImpl(4, 2, create2, deps);
    }
    function updateLayoutEffect(create2, deps) {
      return updateEffectImpl(4, 4, create2, deps);
    }
    function imperativeHandleEffect(create2, ref) {
      if ("function" === typeof ref) {
        create2 = create2();
        var refCleanup = ref(create2);
        return function() {
          "function" === typeof refCleanup ? refCleanup() : ref(null);
        };
      }
      if (null !== ref && void 0 !== ref)
        return create2 = create2(), ref.current = create2, function() {
          ref.current = null;
        };
    }
    function updateImperativeHandle(ref, create2, deps) {
      deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
      updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create2, ref), deps);
    }
    function mountDebugValue() {
    }
    function updateCallback(callback, deps) {
      var hook = updateWorkInProgressHook();
      deps = void 0 === deps ? null : deps;
      var prevState = hook.memoizedState;
      if (null !== deps && areHookInputsEqual(deps, prevState[1]))
        return prevState[0];
      hook.memoizedState = [callback, deps];
      return callback;
    }
    function updateMemo(nextCreate, deps) {
      var hook = updateWorkInProgressHook();
      deps = void 0 === deps ? null : deps;
      var prevState = hook.memoizedState;
      if (null !== deps && areHookInputsEqual(deps, prevState[1]))
        return prevState[0];
      prevState = nextCreate();
      if (shouldDoubleInvokeUserFnsInHooksDEV) {
        setIsStrictModeForDevtools(true);
        try {
          nextCreate();
        } finally {
          setIsStrictModeForDevtools(false);
        }
      }
      hook.memoizedState = [prevState, deps];
      return prevState;
    }
    function mountDeferredValueImpl(hook, value, initialValue) {
      if (void 0 === initialValue || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
        return hook.memoizedState = value;
      hook.memoizedState = initialValue;
      hook = requestDeferredLane();
      currentlyRenderingFiber.lanes |= hook;
      workInProgressRootSkippedLanes |= hook;
      return initialValue;
    }
    function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
      if (objectIs(value, prevValue)) return value;
      if (null !== currentTreeHiddenStackCursor.current)
        return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
      if (0 === (renderLanes & 42) || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
        return didReceiveUpdate = true, hook.memoizedState = value;
      hook = requestDeferredLane();
      currentlyRenderingFiber.lanes |= hook;
      workInProgressRootSkippedLanes |= hook;
      return prevValue;
    }
    function startTransition(fiber, queue, pendingState, finishedState, callback) {
      var previousPriority = ReactDOMSharedInternals.p;
      ReactDOMSharedInternals.p = 0 !== previousPriority && 8 > previousPriority ? previousPriority : 8;
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      dispatchOptimisticSetState(fiber, false, queue, pendingState);
      try {
        var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        if (null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then) {
          var thenableForFinishedState = chainThenableValue(
            returnValue,
            finishedState
          );
          dispatchSetStateInternal(
            fiber,
            queue,
            thenableForFinishedState,
            requestUpdateLane(fiber)
          );
        } else
          dispatchSetStateInternal(
            fiber,
            queue,
            finishedState,
            requestUpdateLane(fiber)
          );
      } catch (error) {
        dispatchSetStateInternal(
          fiber,
          queue,
          { then: function() {
          }, status: "rejected", reason: error },
          requestUpdateLane()
        );
      } finally {
        ReactDOMSharedInternals.p = previousPriority, null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    }
    function noop() {
    }
    function startHostTransition(formFiber, pendingState, action, formData) {
      if (5 !== formFiber.tag) throw Error(formatProdErrorMessage(476));
      var queue = ensureFormComponentIsStateful(formFiber).queue;
      startTransition(
        formFiber,
        queue,
        pendingState,
        sharedNotPendingObject,
        null === action ? noop : function() {
          requestFormReset$1(formFiber);
          return action(formData);
        }
      );
    }
    function ensureFormComponentIsStateful(formFiber) {
      var existingStateHook = formFiber.memoizedState;
      if (null !== existingStateHook) return existingStateHook;
      existingStateHook = {
        memoizedState: sharedNotPendingObject,
        baseState: sharedNotPendingObject,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: basicStateReducer,
          lastRenderedState: sharedNotPendingObject
        },
        next: null
      };
      var initialResetState = {};
      existingStateHook.next = {
        memoizedState: initialResetState,
        baseState: initialResetState,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: basicStateReducer,
          lastRenderedState: initialResetState
        },
        next: null
      };
      formFiber.memoizedState = existingStateHook;
      formFiber = formFiber.alternate;
      null !== formFiber && (formFiber.memoizedState = existingStateHook);
      return existingStateHook;
    }
    function requestFormReset$1(formFiber) {
      var stateHook = ensureFormComponentIsStateful(formFiber);
      null === stateHook.next && (stateHook = formFiber.alternate.memoizedState);
      dispatchSetStateInternal(
        formFiber,
        stateHook.next.queue,
        {},
        requestUpdateLane()
      );
    }
    function useHostTransitionStatus() {
      return readContext(HostTransitionContext);
    }
    function updateId() {
      return updateWorkInProgressHook().memoizedState;
    }
    function updateRefresh() {
      return updateWorkInProgressHook().memoizedState;
    }
    function refreshCache(fiber) {
      for (var provider = fiber.return; null !== provider; ) {
        switch (provider.tag) {
          case 24:
          case 3:
            var lane = requestUpdateLane();
            fiber = createUpdate(lane);
            var root$69 = enqueueUpdate(provider, fiber, lane);
            null !== root$69 && (scheduleUpdateOnFiber(root$69, provider, lane), entangleTransitions(root$69, provider, lane));
            provider = { cache: createCache() };
            fiber.payload = provider;
            return;
        }
        provider = provider.return;
      }
    }
    function dispatchReducerAction(fiber, queue, action) {
      var lane = requestUpdateLane();
      action = {
        lane,
        revertLane: 0,
        gesture: null,
        action,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), null !== action && (scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
    }
    function dispatchSetState(fiber, queue, action) {
      var lane = requestUpdateLane();
      dispatchSetStateInternal(fiber, queue, action, lane);
    }
    function dispatchSetStateInternal(fiber, queue, action, lane) {
      var update = {
        lane,
        revertLane: 0,
        gesture: null,
        action,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (isRenderPhaseUpdate(fiber)) enqueueRenderPhaseUpdate(queue, update);
      else {
        var alternate = fiber.alternate;
        if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && (alternate = queue.lastRenderedReducer, null !== alternate))
          try {
            var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
            update.hasEagerState = true;
            update.eagerState = eagerState;
            if (objectIs(eagerState, currentState))
              return enqueueUpdate$1(fiber, queue, update, 0), null === workInProgressRoot && finishQueueingConcurrentUpdates(), false;
          } catch (error) {
          } finally {
          }
        action = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
        if (null !== action)
          return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
      }
      return false;
    }
    function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
      action = {
        lane: 2,
        revertLane: requestTransitionLane(),
        gesture: null,
        action,
        hasEagerState: false,
        eagerState: null,
        next: null
      };
      if (isRenderPhaseUpdate(fiber)) {
        if (throwIfDuringRender) throw Error(formatProdErrorMessage(479));
      } else
        throwIfDuringRender = enqueueConcurrentHookUpdate(
          fiber,
          queue,
          action,
          2
        ), null !== throwIfDuringRender && scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2);
    }
    function isRenderPhaseUpdate(fiber) {
      var alternate = fiber.alternate;
      return fiber === currentlyRenderingFiber || null !== alternate && alternate === currentlyRenderingFiber;
    }
    function enqueueRenderPhaseUpdate(queue, update) {
      didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
      var pending = queue.pending;
      null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
      queue.pending = update;
    }
    function entangleTransitionUpdate(root2, queue, lane) {
      if (0 !== (lane & 4194048)) {
        var queueLanes = queue.lanes;
        queueLanes &= root2.pendingLanes;
        lane |= queueLanes;
        queue.lanes = lane;
        markRootEntangled(root2, lane);
      }
    }
    var ContextOnlyDispatcher = {
      readContext,
      use,
      useCallback: throwInvalidHookError,
      useContext: throwInvalidHookError,
      useEffect: throwInvalidHookError,
      useImperativeHandle: throwInvalidHookError,
      useLayoutEffect: throwInvalidHookError,
      useInsertionEffect: throwInvalidHookError,
      useMemo: throwInvalidHookError,
      useReducer: throwInvalidHookError,
      useRef: throwInvalidHookError,
      useState: throwInvalidHookError,
      useDebugValue: throwInvalidHookError,
      useDeferredValue: throwInvalidHookError,
      useTransition: throwInvalidHookError,
      useSyncExternalStore: throwInvalidHookError,
      useId: throwInvalidHookError,
      useHostTransitionStatus: throwInvalidHookError,
      useFormState: throwInvalidHookError,
      useActionState: throwInvalidHookError,
      useOptimistic: throwInvalidHookError,
      useMemoCache: throwInvalidHookError,
      useCacheRefresh: throwInvalidHookError
    };
    ContextOnlyDispatcher.useEffectEvent = throwInvalidHookError;
    var HooksDispatcherOnMount = {
      readContext,
      use,
      useCallback: function(callback, deps) {
        mountWorkInProgressHook().memoizedState = [
          callback,
          void 0 === deps ? null : deps
        ];
        return callback;
      },
      useContext: readContext,
      useEffect: mountEffect,
      useImperativeHandle: function(ref, create2, deps) {
        deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
        mountEffectImpl(
          4194308,
          4,
          imperativeHandleEffect.bind(null, create2, ref),
          deps
        );
      },
      useLayoutEffect: function(create2, deps) {
        return mountEffectImpl(4194308, 4, create2, deps);
      },
      useInsertionEffect: function(create2, deps) {
        mountEffectImpl(4, 2, create2, deps);
      },
      useMemo: function(nextCreate, deps) {
        var hook = mountWorkInProgressHook();
        deps = void 0 === deps ? null : deps;
        var nextValue = nextCreate();
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            nextCreate();
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
        hook.memoizedState = [nextValue, deps];
        return nextValue;
      },
      useReducer: function(reducer, initialArg, init) {
        var hook = mountWorkInProgressHook();
        if (void 0 !== init) {
          var initialState = init(initialArg);
          if (shouldDoubleInvokeUserFnsInHooksDEV) {
            setIsStrictModeForDevtools(true);
            try {
              init(initialArg);
            } finally {
              setIsStrictModeForDevtools(false);
            }
          }
        } else initialState = initialArg;
        hook.memoizedState = hook.baseState = initialState;
        reducer = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: reducer,
          lastRenderedState: initialState
        };
        hook.queue = reducer;
        reducer = reducer.dispatch = dispatchReducerAction.bind(
          null,
          currentlyRenderingFiber,
          reducer
        );
        return [hook.memoizedState, reducer];
      },
      useRef: function(initialValue) {
        var hook = mountWorkInProgressHook();
        initialValue = { current: initialValue };
        return hook.memoizedState = initialValue;
      },
      useState: function(initialState) {
        initialState = mountStateImpl(initialState);
        var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
        queue.dispatch = dispatch;
        return [initialState.memoizedState, dispatch];
      },
      useDebugValue: mountDebugValue,
      useDeferredValue: function(value, initialValue) {
        var hook = mountWorkInProgressHook();
        return mountDeferredValueImpl(hook, value, initialValue);
      },
      useTransition: function() {
        var stateHook = mountStateImpl(false);
        stateHook = startTransition.bind(
          null,
          currentlyRenderingFiber,
          stateHook.queue,
          true,
          false
        );
        mountWorkInProgressHook().memoizedState = stateHook;
        return [false, stateHook];
      },
      useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
        var fiber = currentlyRenderingFiber, hook = mountWorkInProgressHook();
        if (isHydrating) {
          if (void 0 === getServerSnapshot)
            throw Error(formatProdErrorMessage(407));
          getServerSnapshot = getServerSnapshot();
        } else {
          getServerSnapshot = getSnapshot();
          if (null === workInProgressRoot)
            throw Error(formatProdErrorMessage(349));
          0 !== (workInProgressRootRenderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
        }
        hook.memoizedState = getServerSnapshot;
        var inst = { value: getServerSnapshot, getSnapshot };
        hook.queue = inst;
        mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
          subscribe
        ]);
        fiber.flags |= 2048;
        pushSimpleEffect(
          9,
          { destroy: void 0 },
          updateStoreInstance.bind(
            null,
            fiber,
            inst,
            getServerSnapshot,
            getSnapshot
          ),
          null
        );
        return getServerSnapshot;
      },
      useId: function() {
        var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
        if (isHydrating) {
          var JSCompiler_inline_result = treeContextOverflow;
          var idWithLeadingBit = treeContextId;
          JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
          identifierPrefix = "_" + identifierPrefix + "R_" + JSCompiler_inline_result;
          JSCompiler_inline_result = localIdCounter++;
          0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
          identifierPrefix += "_";
        } else
          JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = "_" + identifierPrefix + "r_" + JSCompiler_inline_result.toString(32) + "_";
        return hook.memoizedState = identifierPrefix;
      },
      useHostTransitionStatus,
      useFormState: mountActionState,
      useActionState: mountActionState,
      useOptimistic: function(passthrough) {
        var hook = mountWorkInProgressHook();
        hook.memoizedState = hook.baseState = passthrough;
        var queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null
        };
        hook.queue = queue;
        hook = dispatchOptimisticSetState.bind(
          null,
          currentlyRenderingFiber,
          true,
          queue
        );
        queue.dispatch = hook;
        return [passthrough, hook];
      },
      useMemoCache,
      useCacheRefresh: function() {
        return mountWorkInProgressHook().memoizedState = refreshCache.bind(
          null,
          currentlyRenderingFiber
        );
      },
      useEffectEvent: function(callback) {
        var hook = mountWorkInProgressHook(), ref = { impl: callback };
        hook.memoizedState = ref;
        return function() {
          if (0 !== (executionContext & 2))
            throw Error(formatProdErrorMessage(440));
          return ref.impl.apply(void 0, arguments);
        };
      }
    };
    var HooksDispatcherOnUpdate = {
      readContext,
      use,
      useCallback: updateCallback,
      useContext: readContext,
      useEffect: updateEffect,
      useImperativeHandle: updateImperativeHandle,
      useInsertionEffect: updateInsertionEffect,
      useLayoutEffect: updateLayoutEffect,
      useMemo: updateMemo,
      useReducer: updateReducer,
      useRef: updateRef,
      useState: function() {
        return updateReducer(basicStateReducer);
      },
      useDebugValue: mountDebugValue,
      useDeferredValue: function(value, initialValue) {
        var hook = updateWorkInProgressHook();
        return updateDeferredValueImpl(
          hook,
          currentHook.memoizedState,
          value,
          initialValue
        );
      },
      useTransition: function() {
        var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
        return [
          "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
          start
        ];
      },
      useSyncExternalStore: updateSyncExternalStore,
      useId: updateId,
      useHostTransitionStatus,
      useFormState: updateActionState,
      useActionState: updateActionState,
      useOptimistic: function(passthrough, reducer) {
        var hook = updateWorkInProgressHook();
        return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
      },
      useMemoCache,
      useCacheRefresh: updateRefresh
    };
    HooksDispatcherOnUpdate.useEffectEvent = updateEvent;
    var HooksDispatcherOnRerender = {
      readContext,
      use,
      useCallback: updateCallback,
      useContext: readContext,
      useEffect: updateEffect,
      useImperativeHandle: updateImperativeHandle,
      useInsertionEffect: updateInsertionEffect,
      useLayoutEffect: updateLayoutEffect,
      useMemo: updateMemo,
      useReducer: rerenderReducer,
      useRef: updateRef,
      useState: function() {
        return rerenderReducer(basicStateReducer);
      },
      useDebugValue: mountDebugValue,
      useDeferredValue: function(value, initialValue) {
        var hook = updateWorkInProgressHook();
        return null === currentHook ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(
          hook,
          currentHook.memoizedState,
          value,
          initialValue
        );
      },
      useTransition: function() {
        var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
        return [
          "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
          start
        ];
      },
      useSyncExternalStore: updateSyncExternalStore,
      useId: updateId,
      useHostTransitionStatus,
      useFormState: rerenderActionState,
      useActionState: rerenderActionState,
      useOptimistic: function(passthrough, reducer) {
        var hook = updateWorkInProgressHook();
        if (null !== currentHook)
          return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
        hook.baseState = passthrough;
        return [passthrough, hook.queue.dispatch];
      },
      useMemoCache,
      useCacheRefresh: updateRefresh
    };
    HooksDispatcherOnRerender.useEffectEvent = updateEvent;
    function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
      ctor = workInProgress2.memoizedState;
      getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
      getDerivedStateFromProps = null === getDerivedStateFromProps || void 0 === getDerivedStateFromProps ? ctor : assign({}, ctor, getDerivedStateFromProps);
      workInProgress2.memoizedState = getDerivedStateFromProps;
      0 === workInProgress2.lanes && (workInProgress2.updateQueue.baseState = getDerivedStateFromProps);
    }
    var classComponentUpdater = {
      enqueueSetState: function(inst, payload, callback) {
        inst = inst._reactInternals;
        var lane = requestUpdateLane(), update = createUpdate(lane);
        update.payload = payload;
        void 0 !== callback && null !== callback && (update.callback = callback);
        payload = enqueueUpdate(inst, update, lane);
        null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
      },
      enqueueReplaceState: function(inst, payload, callback) {
        inst = inst._reactInternals;
        var lane = requestUpdateLane(), update = createUpdate(lane);
        update.tag = 1;
        update.payload = payload;
        void 0 !== callback && null !== callback && (update.callback = callback);
        payload = enqueueUpdate(inst, update, lane);
        null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
      },
      enqueueForceUpdate: function(inst, callback) {
        inst = inst._reactInternals;
        var lane = requestUpdateLane(), update = createUpdate(lane);
        update.tag = 2;
        void 0 !== callback && null !== callback && (update.callback = callback);
        callback = enqueueUpdate(inst, update, lane);
        null !== callback && (scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
      }
    };
    function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
      workInProgress2 = workInProgress2.stateNode;
      return "function" === typeof workInProgress2.shouldComponentUpdate ? workInProgress2.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
    }
    function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
      workInProgress2 = instance.state;
      "function" === typeof instance.componentWillReceiveProps && instance.componentWillReceiveProps(newProps, nextContext);
      "function" === typeof instance.UNSAFE_componentWillReceiveProps && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
      instance.state !== workInProgress2 && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
    }
    function resolveClassComponentProps(Component, baseProps) {
      var newProps = baseProps;
      if ("ref" in baseProps) {
        newProps = {};
        for (var propName in baseProps)
          "ref" !== propName && (newProps[propName] = baseProps[propName]);
      }
      if (Component = Component.defaultProps) {
        newProps === baseProps && (newProps = assign({}, newProps));
        for (var propName$73 in Component)
          void 0 === newProps[propName$73] && (newProps[propName$73] = Component[propName$73]);
      }
      return newProps;
    }
    function defaultOnUncaughtError(error) {
      reportGlobalError(error);
    }
    function defaultOnCaughtError(error) {
      console.error(error);
    }
    function defaultOnRecoverableError(error) {
      reportGlobalError(error);
    }
    function logUncaughtError(root2, errorInfo) {
      try {
        var onUncaughtError = root2.onUncaughtError;
        onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
      } catch (e$74) {
        setTimeout(function() {
          throw e$74;
        });
      }
    }
    function logCaughtError(root2, boundary, errorInfo) {
      try {
        var onCaughtError = root2.onCaughtError;
        onCaughtError(errorInfo.value, {
          componentStack: errorInfo.stack,
          errorBoundary: 1 === boundary.tag ? boundary.stateNode : null
        });
      } catch (e$75) {
        setTimeout(function() {
          throw e$75;
        });
      }
    }
    function createRootErrorUpdate(root2, errorInfo, lane) {
      lane = createUpdate(lane);
      lane.tag = 3;
      lane.payload = { element: null };
      lane.callback = function() {
        logUncaughtError(root2, errorInfo);
      };
      return lane;
    }
    function createClassErrorUpdate(lane) {
      lane = createUpdate(lane);
      lane.tag = 3;
      return lane;
    }
    function initializeClassErrorUpdate(update, root2, fiber, errorInfo) {
      var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
      if ("function" === typeof getDerivedStateFromError) {
        var error = errorInfo.value;
        update.payload = function() {
          return getDerivedStateFromError(error);
        };
        update.callback = function() {
          logCaughtError(root2, fiber, errorInfo);
        };
      }
      var inst = fiber.stateNode;
      null !== inst && "function" === typeof inst.componentDidCatch && (update.callback = function() {
        logCaughtError(root2, fiber, errorInfo);
        "function" !== typeof getDerivedStateFromError && (null === legacyErrorBoundariesThatAlreadyFailed ? legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
        var stack = errorInfo.stack;
        this.componentDidCatch(errorInfo.value, {
          componentStack: null !== stack ? stack : ""
        });
      });
    }
    function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
      sourceFiber.flags |= 32768;
      if (null !== value && "object" === typeof value && "function" === typeof value.then) {
        returnFiber = sourceFiber.alternate;
        null !== returnFiber && propagateParentContextChanges(
          returnFiber,
          sourceFiber,
          rootRenderLanes,
          true
        );
        sourceFiber = suspenseHandlerStackCursor.current;
        if (null !== sourceFiber) {
          switch (sourceFiber.tag) {
            case 31:
            case 13:
              return null === shellBoundary ? renderDidSuspendDelayIfPossible() : null === sourceFiber.alternate && 0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? sourceFiber.updateQueue = /* @__PURE__ */ new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
            case 22:
              return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? (returnFiber = {
                transitions: null,
                markerInstances: null,
                retryQueue: /* @__PURE__ */ new Set([value])
              }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, null === sourceFiber ? returnFiber.retryQueue = /* @__PURE__ */ new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
          }
          throw Error(formatProdErrorMessage(435, sourceFiber.tag));
        }
        attachPingListener(root2, value, rootRenderLanes);
        renderDidSuspendDelayIfPossible();
        return false;
      }
      if (isHydrating)
        return returnFiber = suspenseHandlerStackCursor.current, null !== returnFiber ? (0 === (returnFiber.flags & 65536) && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
          cause: value
        }), queueHydrationError(
          createCapturedValueAtFiber(returnFiber, sourceFiber)
        )), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(
          root2.stateNode,
          value,
          rootRenderLanes
        ), enqueueCapturedUpdate(root2, rootRenderLanes), 4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2)), false;
      var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
      wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
      null === workInProgressRootConcurrentErrors ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
      4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2);
      if (null === returnFiber) return true;
      value = createCapturedValueAtFiber(value, sourceFiber);
      sourceFiber = returnFiber;
      do {
        switch (sourceFiber.tag) {
          case 3:
            return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
          case 1:
            if (returnFiber = sourceFiber.type, wrapperError = sourceFiber.stateNode, 0 === (sourceFiber.flags & 128) && ("function" === typeof returnFiber.getDerivedStateFromError || null !== wrapperError && "function" === typeof wrapperError.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
              return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(
                rootRenderLanes,
                root2,
                sourceFiber,
                value
              ), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
        }
        sourceFiber = sourceFiber.return;
      } while (null !== sourceFiber);
      return false;
    }
    var SelectiveHydrationException = Error(formatProdErrorMessage(461));
    var didReceiveUpdate = false;
    function reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2) {
      workInProgress2.child = null === current2 ? mountChildFibers(workInProgress2, null, nextChildren, renderLanes2) : reconcileChildFibers(
        workInProgress2,
        current2.child,
        nextChildren,
        renderLanes2
      );
    }
    function updateForwardRef(current2, workInProgress2, Component, nextProps, renderLanes2) {
      Component = Component.render;
      var ref = workInProgress2.ref;
      if ("ref" in nextProps) {
        var propsWithoutRef = {};
        for (var key in nextProps)
          "ref" !== key && (propsWithoutRef[key] = nextProps[key]);
      } else propsWithoutRef = nextProps;
      prepareToReadContext(workInProgress2);
      nextProps = renderWithHooks(
        current2,
        workInProgress2,
        Component,
        propsWithoutRef,
        ref,
        renderLanes2
      );
      key = checkDidRenderIdHook();
      if (null !== current2 && !didReceiveUpdate)
        return bailoutHooks(current2, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
      isHydrating && key && pushMaterializedTreeId(workInProgress2);
      workInProgress2.flags |= 1;
      reconcileChildren(current2, workInProgress2, nextProps, renderLanes2);
      return workInProgress2.child;
    }
    function updateMemoComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
      if (null === current2) {
        var type = Component.type;
        if ("function" === typeof type && !shouldConstruct(type) && void 0 === type.defaultProps && null === Component.compare)
          return workInProgress2.tag = 15, workInProgress2.type = type, updateSimpleMemoComponent(
            current2,
            workInProgress2,
            type,
            nextProps,
            renderLanes2
          );
        current2 = createFiberFromTypeAndProps(
          Component.type,
          null,
          nextProps,
          workInProgress2,
          workInProgress2.mode,
          renderLanes2
        );
        current2.ref = workInProgress2.ref;
        current2.return = workInProgress2;
        return workInProgress2.child = current2;
      }
      type = current2.child;
      if (!checkScheduledUpdateOrContext(current2, renderLanes2)) {
        var prevProps = type.memoizedProps;
        Component = Component.compare;
        Component = null !== Component ? Component : shallowEqual;
        if (Component(prevProps, nextProps) && current2.ref === workInProgress2.ref)
          return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
      }
      workInProgress2.flags |= 1;
      current2 = createWorkInProgress(type, nextProps);
      current2.ref = workInProgress2.ref;
      current2.return = workInProgress2;
      return workInProgress2.child = current2;
    }
    function updateSimpleMemoComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
      if (null !== current2) {
        var prevProps = current2.memoizedProps;
        if (shallowEqual(prevProps, nextProps) && current2.ref === workInProgress2.ref)
          if (didReceiveUpdate = false, workInProgress2.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current2, renderLanes2))
            0 !== (current2.flags & 131072) && (didReceiveUpdate = true);
          else
            return workInProgress2.lanes = current2.lanes, bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
      }
      return updateFunctionComponent(
        current2,
        workInProgress2,
        Component,
        nextProps,
        renderLanes2
      );
    }
    function updateOffscreenComponent(current2, workInProgress2, renderLanes2, nextProps) {
      var nextChildren = nextProps.children, prevState = null !== current2 ? current2.memoizedState : null;
      null === current2 && null === workInProgress2.stateNode && (workInProgress2.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      });
      if ("hidden" === nextProps.mode) {
        if (0 !== (workInProgress2.flags & 128)) {
          prevState = null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2;
          if (null !== current2) {
            nextProps = workInProgress2.child = current2.child;
            for (nextChildren = 0; null !== nextProps; )
              nextChildren = nextChildren | nextProps.lanes | nextProps.childLanes, nextProps = nextProps.sibling;
            nextProps = nextChildren & ~prevState;
          } else nextProps = 0, workInProgress2.child = null;
          return deferHiddenOffscreenComponent(
            current2,
            workInProgress2,
            prevState,
            renderLanes2,
            nextProps
          );
        }
        if (0 !== (renderLanes2 & 536870912))
          workInProgress2.memoizedState = { baseLanes: 0, cachePool: null }, null !== current2 && pushTransition(
            workInProgress2,
            null !== prevState ? prevState.cachePool : null
          ), null !== prevState ? pushHiddenContext(workInProgress2, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress2);
        else
          return nextProps = workInProgress2.lanes = 536870912, deferHiddenOffscreenComponent(
            current2,
            workInProgress2,
            null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2,
            renderLanes2,
            nextProps
          );
      } else
        null !== prevState ? (pushTransition(workInProgress2, prevState.cachePool), pushHiddenContext(workInProgress2, prevState), reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.memoizedState = null) : (null !== current2 && pushTransition(workInProgress2, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack(workInProgress2));
      reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
      return workInProgress2.child;
    }
    function bailoutOffscreenComponent(current2, workInProgress2) {
      null !== current2 && 22 === current2.tag || null !== workInProgress2.stateNode || (workInProgress2.stateNode = {
        _visibility: 1,
        _pendingMarkers: null,
        _retryCache: null,
        _transitions: null
      });
      return workInProgress2.sibling;
    }
    function deferHiddenOffscreenComponent(current2, workInProgress2, nextBaseLanes, renderLanes2, remainingChildLanes) {
      var JSCompiler_inline_result = peekCacheFromPool();
      JSCompiler_inline_result = null === JSCompiler_inline_result ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
      workInProgress2.memoizedState = {
        baseLanes: nextBaseLanes,
        cachePool: JSCompiler_inline_result
      };
      null !== current2 && pushTransition(workInProgress2, null);
      reuseHiddenContextOnStack();
      pushOffscreenSuspenseHandler(workInProgress2);
      null !== current2 && propagateParentContextChanges(current2, workInProgress2, renderLanes2, true);
      workInProgress2.childLanes = remainingChildLanes;
      return null;
    }
    function mountActivityChildren(workInProgress2, nextProps) {
      nextProps = mountWorkInProgressOffscreenFiber(
        { mode: nextProps.mode, children: nextProps.children },
        workInProgress2.mode
      );
      nextProps.ref = workInProgress2.ref;
      workInProgress2.child = nextProps;
      nextProps.return = workInProgress2;
      return nextProps;
    }
    function retryActivityComponentWithoutHydrating(current2, workInProgress2, renderLanes2) {
      reconcileChildFibers(workInProgress2, current2.child, null, renderLanes2);
      current2 = mountActivityChildren(workInProgress2, workInProgress2.pendingProps);
      current2.flags |= 2;
      popSuspenseHandler(workInProgress2);
      workInProgress2.memoizedState = null;
      return current2;
    }
    function updateActivityComponent(current2, workInProgress2, renderLanes2) {
      var nextProps = workInProgress2.pendingProps, didSuspend = 0 !== (workInProgress2.flags & 128);
      workInProgress2.flags &= -129;
      if (null === current2) {
        if (isHydrating) {
          if ("hidden" === nextProps.mode)
            return current2 = mountActivityChildren(workInProgress2, nextProps), workInProgress2.lanes = 536870912, bailoutOffscreenComponent(null, current2);
          pushDehydratedActivitySuspenseHandler(workInProgress2);
          (current2 = nextHydratableInstance) ? (current2 = canHydrateHydrationBoundary(
            current2,
            rootOrSingletonContext
          ), current2 = null !== current2 && "&" === current2.data ? current2 : null, null !== current2 && (workInProgress2.memoizedState = {
            dehydrated: current2,
            treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, renderLanes2 = createFiberFromDehydratedFragment(current2), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current2 = null;
          if (null === current2) throw throwOnHydrationMismatch(workInProgress2);
          workInProgress2.lanes = 536870912;
          return null;
        }
        return mountActivityChildren(workInProgress2, nextProps);
      }
      var prevState = current2.memoizedState;
      if (null !== prevState) {
        var dehydrated = prevState.dehydrated;
        pushDehydratedActivitySuspenseHandler(workInProgress2);
        if (didSuspend)
          if (workInProgress2.flags & 256)
            workInProgress2.flags &= -257, workInProgress2 = retryActivityComponentWithoutHydrating(
              current2,
              workInProgress2,
              renderLanes2
            );
          else if (null !== workInProgress2.memoizedState)
            workInProgress2.child = current2.child, workInProgress2.flags |= 128, workInProgress2 = null;
          else throw Error(formatProdErrorMessage(558));
        else if (didReceiveUpdate || propagateParentContextChanges(current2, workInProgress2, renderLanes2, false), didSuspend = 0 !== (renderLanes2 & current2.childLanes), didReceiveUpdate || didSuspend) {
          nextProps = workInProgressRoot;
          if (null !== nextProps && (dehydrated = getBumpedLaneForHydration(nextProps, renderLanes2), 0 !== dehydrated && dehydrated !== prevState.retryLane))
            throw prevState.retryLane = dehydrated, enqueueConcurrentRenderForLane(current2, dehydrated), scheduleUpdateOnFiber(nextProps, current2, dehydrated), SelectiveHydrationException;
          renderDidSuspendDelayIfPossible();
          workInProgress2 = retryActivityComponentWithoutHydrating(
            current2,
            workInProgress2,
            renderLanes2
          );
        } else
          current2 = prevState.treeContext, nextHydratableInstance = getNextHydratable(dehydrated.nextSibling), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current2 && restoreSuspendedTreeContext(workInProgress2, current2), workInProgress2 = mountActivityChildren(workInProgress2, nextProps), workInProgress2.flags |= 4096;
        return workInProgress2;
      }
      current2 = createWorkInProgress(current2.child, {
        mode: nextProps.mode,
        children: nextProps.children
      });
      current2.ref = workInProgress2.ref;
      workInProgress2.child = current2;
      current2.return = workInProgress2;
      return current2;
    }
    function markRef(current2, workInProgress2) {
      var ref = workInProgress2.ref;
      if (null === ref)
        null !== current2 && null !== current2.ref && (workInProgress2.flags |= 4194816);
      else {
        if ("function" !== typeof ref && "object" !== typeof ref)
          throw Error(formatProdErrorMessage(284));
        if (null === current2 || current2.ref !== ref)
          workInProgress2.flags |= 4194816;
      }
    }
    function updateFunctionComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
      prepareToReadContext(workInProgress2);
      Component = renderWithHooks(
        current2,
        workInProgress2,
        Component,
        nextProps,
        void 0,
        renderLanes2
      );
      nextProps = checkDidRenderIdHook();
      if (null !== current2 && !didReceiveUpdate)
        return bailoutHooks(current2, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
      isHydrating && nextProps && pushMaterializedTreeId(workInProgress2);
      workInProgress2.flags |= 1;
      reconcileChildren(current2, workInProgress2, Component, renderLanes2);
      return workInProgress2.child;
    }
    function replayFunctionComponent(current2, workInProgress2, nextProps, Component, secondArg, renderLanes2) {
      prepareToReadContext(workInProgress2);
      workInProgress2.updateQueue = null;
      nextProps = renderWithHooksAgain(
        workInProgress2,
        Component,
        nextProps,
        secondArg
      );
      finishRenderingHooks(current2);
      Component = checkDidRenderIdHook();
      if (null !== current2 && !didReceiveUpdate)
        return bailoutHooks(current2, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
      isHydrating && Component && pushMaterializedTreeId(workInProgress2);
      workInProgress2.flags |= 1;
      reconcileChildren(current2, workInProgress2, nextProps, renderLanes2);
      return workInProgress2.child;
    }
    function updateClassComponent(current2, workInProgress2, Component, nextProps, renderLanes2) {
      prepareToReadContext(workInProgress2);
      if (null === workInProgress2.stateNode) {
        var context = emptyContextObject, contextType = Component.contextType;
        "object" === typeof contextType && null !== contextType && (context = readContext(contextType));
        context = new Component(nextProps, context);
        workInProgress2.memoizedState = null !== context.state && void 0 !== context.state ? context.state : null;
        context.updater = classComponentUpdater;
        workInProgress2.stateNode = context;
        context._reactInternals = workInProgress2;
        context = workInProgress2.stateNode;
        context.props = nextProps;
        context.state = workInProgress2.memoizedState;
        context.refs = {};
        initializeUpdateQueue(workInProgress2);
        contextType = Component.contextType;
        context.context = "object" === typeof contextType && null !== contextType ? readContext(contextType) : emptyContextObject;
        context.state = workInProgress2.memoizedState;
        contextType = Component.getDerivedStateFromProps;
        "function" === typeof contextType && (applyDerivedStateFromProps(
          workInProgress2,
          Component,
          contextType,
          nextProps
        ), context.state = workInProgress2.memoizedState);
        "function" === typeof Component.getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || (contextType = context.state, "function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress2, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress2.memoizedState);
        "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308);
        nextProps = true;
      } else if (null === current2) {
        context = workInProgress2.stateNode;
        var unresolvedOldProps = workInProgress2.memoizedProps, oldProps = resolveClassComponentProps(Component, unresolvedOldProps);
        context.props = oldProps;
        var oldContext = context.context, contextType$jscomp$0 = Component.contextType;
        contextType = emptyContextObject;
        "object" === typeof contextType$jscomp$0 && null !== contextType$jscomp$0 && (contextType = readContext(contextType$jscomp$0));
        var getDerivedStateFromProps = Component.getDerivedStateFromProps;
        contextType$jscomp$0 = "function" === typeof getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate;
        unresolvedOldProps = workInProgress2.pendingProps !== unresolvedOldProps;
        contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(
          workInProgress2,
          context,
          nextProps,
          contextType
        );
        hasForceUpdate = false;
        var oldState = workInProgress2.memoizedState;
        context.state = oldState;
        processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
        suspendIfUpdateReadFromEntangledAsyncAction();
        oldContext = workInProgress2.memoizedState;
        unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? ("function" === typeof getDerivedStateFromProps && (applyDerivedStateFromProps(
          workInProgress2,
          Component,
          getDerivedStateFromProps,
          nextProps
        ), oldContext = workInProgress2.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(
          workInProgress2,
          Component,
          oldProps,
          nextProps,
          oldState,
          oldContext,
          contextType
        )) ? (contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || ("function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount()), "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308)) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), nextProps = false);
      } else {
        context = workInProgress2.stateNode;
        cloneUpdateQueue(current2, workInProgress2);
        contextType = workInProgress2.memoizedProps;
        contextType$jscomp$0 = resolveClassComponentProps(Component, contextType);
        context.props = contextType$jscomp$0;
        getDerivedStateFromProps = workInProgress2.pendingProps;
        oldState = context.context;
        oldContext = Component.contextType;
        oldProps = emptyContextObject;
        "object" === typeof oldContext && null !== oldContext && (oldProps = readContext(oldContext));
        unresolvedOldProps = Component.getDerivedStateFromProps;
        (oldContext = "function" === typeof unresolvedOldProps || "function" === typeof context.getSnapshotBeforeUpdate) || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(
          workInProgress2,
          context,
          nextProps,
          oldProps
        );
        hasForceUpdate = false;
        oldState = workInProgress2.memoizedState;
        context.state = oldState;
        processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
        suspendIfUpdateReadFromEntangledAsyncAction();
        var newState = workInProgress2.memoizedState;
        contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || null !== current2 && null !== current2.dependencies && checkIfContextChanged(current2.dependencies) ? ("function" === typeof unresolvedOldProps && (applyDerivedStateFromProps(
          workInProgress2,
          Component,
          unresolvedOldProps,
          nextProps
        ), newState = workInProgress2.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(
          workInProgress2,
          Component,
          contextType$jscomp$0,
          nextProps,
          oldState,
          newState,
          oldProps
        ) || null !== current2 && null !== current2.dependencies && checkIfContextChanged(current2.dependencies)) ? (oldContext || "function" !== typeof context.UNSAFE_componentWillUpdate && "function" !== typeof context.componentWillUpdate || ("function" === typeof context.componentWillUpdate && context.componentWillUpdate(nextProps, newState, oldProps), "function" === typeof context.UNSAFE_componentWillUpdate && context.UNSAFE_componentWillUpdate(
          nextProps,
          newState,
          oldProps
        )), "function" === typeof context.componentDidUpdate && (workInProgress2.flags |= 4), "function" === typeof context.getSnapshotBeforeUpdate && (workInProgress2.flags |= 1024)) : ("function" !== typeof context.componentDidUpdate || contextType === current2.memoizedProps && oldState === current2.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current2.memoizedProps && oldState === current2.memoizedState || (workInProgress2.flags |= 1024), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : ("function" !== typeof context.componentDidUpdate || contextType === current2.memoizedProps && oldState === current2.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current2.memoizedProps && oldState === current2.memoizedState || (workInProgress2.flags |= 1024), nextProps = false);
      }
      context = nextProps;
      markRef(current2, workInProgress2);
      nextProps = 0 !== (workInProgress2.flags & 128);
      context || nextProps ? (context = workInProgress2.stateNode, Component = nextProps && "function" !== typeof Component.getDerivedStateFromError ? null : context.render(), workInProgress2.flags |= 1, null !== current2 && nextProps ? (workInProgress2.child = reconcileChildFibers(
        workInProgress2,
        current2.child,
        null,
        renderLanes2
      ), workInProgress2.child = reconcileChildFibers(
        workInProgress2,
        null,
        Component,
        renderLanes2
      )) : reconcileChildren(current2, workInProgress2, Component, renderLanes2), workInProgress2.memoizedState = context.state, current2 = workInProgress2.child) : current2 = bailoutOnAlreadyFinishedWork(
        current2,
        workInProgress2,
        renderLanes2
      );
      return current2;
    }
    function mountHostRootWithoutHydrating(current2, workInProgress2, nextChildren, renderLanes2) {
      resetHydrationState();
      workInProgress2.flags |= 256;
      reconcileChildren(current2, workInProgress2, nextChildren, renderLanes2);
      return workInProgress2.child;
    }
    var SUSPENDED_MARKER = {
      dehydrated: null,
      treeContext: null,
      retryLane: 0,
      hydrationErrors: null
    };
    function mountSuspenseOffscreenState(renderLanes2) {
      return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
    }
    function getRemainingWorkInPrimaryTree(current2, primaryTreeDidDefer, renderLanes2) {
      current2 = null !== current2 ? current2.childLanes & ~renderLanes2 : 0;
      primaryTreeDidDefer && (current2 |= workInProgressDeferredLane);
      return current2;
    }
    function updateSuspenseComponent(current2, workInProgress2, renderLanes2) {
      var nextProps = workInProgress2.pendingProps, showFallback = false, didSuspend = 0 !== (workInProgress2.flags & 128), JSCompiler_temp;
      (JSCompiler_temp = didSuspend) || (JSCompiler_temp = null !== current2 && null === current2.memoizedState ? false : 0 !== (suspenseStackCursor.current & 2));
      JSCompiler_temp && (showFallback = true, workInProgress2.flags &= -129);
      JSCompiler_temp = 0 !== (workInProgress2.flags & 32);
      workInProgress2.flags &= -33;
      if (null === current2) {
        if (isHydrating) {
          showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress2) : reuseSuspenseHandlerOnStack(workInProgress2);
          (current2 = nextHydratableInstance) ? (current2 = canHydrateHydrationBoundary(
            current2,
            rootOrSingletonContext
          ), current2 = null !== current2 && "&" !== current2.data ? current2 : null, null !== current2 && (workInProgress2.memoizedState = {
            dehydrated: current2,
            treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
            retryLane: 536870912,
            hydrationErrors: null
          }, renderLanes2 = createFiberFromDehydratedFragment(current2), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current2 = null;
          if (null === current2) throw throwOnHydrationMismatch(workInProgress2);
          isSuspenseInstanceFallback(current2) ? workInProgress2.lanes = 32 : workInProgress2.lanes = 536870912;
          return null;
        }
        var nextPrimaryChildren = nextProps.children;
        nextProps = nextProps.fallback;
        if (showFallback)
          return reuseSuspenseHandlerOnStack(workInProgress2), showFallback = workInProgress2.mode, nextPrimaryChildren = mountWorkInProgressOffscreenFiber(
            { mode: "hidden", children: nextPrimaryChildren },
            showFallback
          ), nextProps = createFiberFromFragment(
            nextProps,
            showFallback,
            renderLanes2,
            null
          ), nextPrimaryChildren.return = workInProgress2, nextProps.return = workInProgress2, nextPrimaryChildren.sibling = nextProps, workInProgress2.child = nextPrimaryChildren, nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
            current2,
            JSCompiler_temp,
            renderLanes2
          ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(null, nextProps);
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        return mountSuspensePrimaryChildren(workInProgress2, nextPrimaryChildren);
      }
      var prevState = current2.memoizedState;
      if (null !== prevState && (nextPrimaryChildren = prevState.dehydrated, null !== nextPrimaryChildren)) {
        if (didSuspend)
          workInProgress2.flags & 256 ? (pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags &= -257, workInProgress2 = retrySuspenseComponentWithoutHydrating(
            current2,
            workInProgress2,
            renderLanes2
          )) : null !== workInProgress2.memoizedState ? (reuseSuspenseHandlerOnStack(workInProgress2), workInProgress2.child = current2.child, workInProgress2.flags |= 128, workInProgress2 = null) : (reuseSuspenseHandlerOnStack(workInProgress2), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress2.mode, nextProps = mountWorkInProgressOffscreenFiber(
            { mode: "visible", children: nextProps.children },
            showFallback
          ), nextPrimaryChildren = createFiberFromFragment(
            nextPrimaryChildren,
            showFallback,
            renderLanes2,
            null
          ), nextPrimaryChildren.flags |= 2, nextProps.return = workInProgress2, nextPrimaryChildren.return = workInProgress2, nextProps.sibling = nextPrimaryChildren, workInProgress2.child = nextProps, reconcileChildFibers(
            workInProgress2,
            current2.child,
            null,
            renderLanes2
          ), nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
            current2,
            JSCompiler_temp,
            renderLanes2
          ), workInProgress2.memoizedState = SUSPENDED_MARKER, workInProgress2 = bailoutOffscreenComponent(null, nextProps));
        else if (pushPrimaryTreeSuspenseHandler(workInProgress2), isSuspenseInstanceFallback(nextPrimaryChildren)) {
          JSCompiler_temp = nextPrimaryChildren.nextSibling && nextPrimaryChildren.nextSibling.dataset;
          if (JSCompiler_temp) var digest = JSCompiler_temp.dgst;
          JSCompiler_temp = digest;
          nextProps = Error(formatProdErrorMessage(419));
          nextProps.stack = "";
          nextProps.digest = JSCompiler_temp;
          queueHydrationError({ value: nextProps, source: null, stack: null });
          workInProgress2 = retrySuspenseComponentWithoutHydrating(
            current2,
            workInProgress2,
            renderLanes2
          );
        } else if (didReceiveUpdate || propagateParentContextChanges(current2, workInProgress2, renderLanes2, false), JSCompiler_temp = 0 !== (renderLanes2 & current2.childLanes), didReceiveUpdate || JSCompiler_temp) {
          JSCompiler_temp = workInProgressRoot;
          if (null !== JSCompiler_temp && (nextProps = getBumpedLaneForHydration(JSCompiler_temp, renderLanes2), 0 !== nextProps && nextProps !== prevState.retryLane))
            throw prevState.retryLane = nextProps, enqueueConcurrentRenderForLane(current2, nextProps), scheduleUpdateOnFiber(JSCompiler_temp, current2, nextProps), SelectiveHydrationException;
          isSuspenseInstancePending(nextPrimaryChildren) || renderDidSuspendDelayIfPossible();
          workInProgress2 = retrySuspenseComponentWithoutHydrating(
            current2,
            workInProgress2,
            renderLanes2
          );
        } else
          isSuspenseInstancePending(nextPrimaryChildren) ? (workInProgress2.flags |= 192, workInProgress2.child = current2.child, workInProgress2 = null) : (current2 = prevState.treeContext, nextHydratableInstance = getNextHydratable(
            nextPrimaryChildren.nextSibling
          ), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current2 && restoreSuspendedTreeContext(workInProgress2, current2), workInProgress2 = mountSuspensePrimaryChildren(
            workInProgress2,
            nextProps.children
          ), workInProgress2.flags |= 4096);
        return workInProgress2;
      }
      if (showFallback)
        return reuseSuspenseHandlerOnStack(workInProgress2), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress2.mode, prevState = current2.child, digest = prevState.sibling, nextProps = createWorkInProgress(prevState, {
          mode: "hidden",
          children: nextProps.children
        }), nextProps.subtreeFlags = prevState.subtreeFlags & 65011712, null !== digest ? nextPrimaryChildren = createWorkInProgress(
          digest,
          nextPrimaryChildren
        ) : (nextPrimaryChildren = createFiberFromFragment(
          nextPrimaryChildren,
          showFallback,
          renderLanes2,
          null
        ), nextPrimaryChildren.flags |= 2), nextPrimaryChildren.return = workInProgress2, nextProps.return = workInProgress2, nextProps.sibling = nextPrimaryChildren, workInProgress2.child = nextProps, bailoutOffscreenComponent(null, nextProps), nextProps = workInProgress2.child, nextPrimaryChildren = current2.child.memoizedState, null === nextPrimaryChildren ? nextPrimaryChildren = mountSuspenseOffscreenState(renderLanes2) : (showFallback = nextPrimaryChildren.cachePool, null !== showFallback ? (prevState = CacheContext._currentValue, showFallback = showFallback.parent !== prevState ? { parent: prevState, pool: prevState } : showFallback) : showFallback = getSuspendedCache(), nextPrimaryChildren = {
          baseLanes: nextPrimaryChildren.baseLanes | renderLanes2,
          cachePool: showFallback
        }), nextProps.memoizedState = nextPrimaryChildren, nextProps.childLanes = getRemainingWorkInPrimaryTree(
          current2,
          JSCompiler_temp,
          renderLanes2
        ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(current2.child, nextProps);
      pushPrimaryTreeSuspenseHandler(workInProgress2);
      renderLanes2 = current2.child;
      current2 = renderLanes2.sibling;
      renderLanes2 = createWorkInProgress(renderLanes2, {
        mode: "visible",
        children: nextProps.children
      });
      renderLanes2.return = workInProgress2;
      renderLanes2.sibling = null;
      null !== current2 && (JSCompiler_temp = workInProgress2.deletions, null === JSCompiler_temp ? (workInProgress2.deletions = [current2], workInProgress2.flags |= 16) : JSCompiler_temp.push(current2));
      workInProgress2.child = renderLanes2;
      workInProgress2.memoizedState = null;
      return renderLanes2;
    }
    function mountSuspensePrimaryChildren(workInProgress2, primaryChildren) {
      primaryChildren = mountWorkInProgressOffscreenFiber(
        { mode: "visible", children: primaryChildren },
        workInProgress2.mode
      );
      primaryChildren.return = workInProgress2;
      return workInProgress2.child = primaryChildren;
    }
    function mountWorkInProgressOffscreenFiber(offscreenProps, mode) {
      offscreenProps = createFiberImplClass(22, offscreenProps, null, mode);
      offscreenProps.lanes = 0;
      return offscreenProps;
    }
    function retrySuspenseComponentWithoutHydrating(current2, workInProgress2, renderLanes2) {
      reconcileChildFibers(workInProgress2, current2.child, null, renderLanes2);
      current2 = mountSuspensePrimaryChildren(
        workInProgress2,
        workInProgress2.pendingProps.children
      );
      current2.flags |= 2;
      workInProgress2.memoizedState = null;
      return current2;
    }
    function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
      fiber.lanes |= renderLanes2;
      var alternate = fiber.alternate;
      null !== alternate && (alternate.lanes |= renderLanes2);
      scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
    }
    function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode, treeForkCount2) {
      var renderState = workInProgress2.memoizedState;
      null === renderState ? workInProgress2.memoizedState = {
        isBackwards,
        rendering: null,
        renderingStartTime: 0,
        last: lastContentRow,
        tail,
        tailMode,
        treeForkCount: treeForkCount2
      } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode, renderState.treeForkCount = treeForkCount2);
    }
    function updateSuspenseListComponent(current2, workInProgress2, renderLanes2) {
      var nextProps = workInProgress2.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
      nextProps = nextProps.children;
      var suspenseContext = suspenseStackCursor.current, shouldForceFallback = 0 !== (suspenseContext & 2);
      shouldForceFallback ? (suspenseContext = suspenseContext & 1 | 2, workInProgress2.flags |= 128) : suspenseContext &= 1;
      push(suspenseStackCursor, suspenseContext);
      reconcileChildren(current2, workInProgress2, nextProps, renderLanes2);
      nextProps = isHydrating ? treeForkCount : 0;
      if (!shouldForceFallback && null !== current2 && 0 !== (current2.flags & 128))
        a: for (current2 = workInProgress2.child; null !== current2; ) {
          if (13 === current2.tag)
            null !== current2.memoizedState && scheduleSuspenseWorkOnFiber(current2, renderLanes2, workInProgress2);
          else if (19 === current2.tag)
            scheduleSuspenseWorkOnFiber(current2, renderLanes2, workInProgress2);
          else if (null !== current2.child) {
            current2.child.return = current2;
            current2 = current2.child;
            continue;
          }
          if (current2 === workInProgress2) break a;
          for (; null === current2.sibling; ) {
            if (null === current2.return || current2.return === workInProgress2)
              break a;
            current2 = current2.return;
          }
          current2.sibling.return = current2.return;
          current2 = current2.sibling;
        }
      switch (revealOrder) {
        case "forwards":
          renderLanes2 = workInProgress2.child;
          for (revealOrder = null; null !== renderLanes2; )
            current2 = renderLanes2.alternate, null !== current2 && null === findFirstSuspended(current2) && (revealOrder = renderLanes2), renderLanes2 = renderLanes2.sibling;
          renderLanes2 = revealOrder;
          null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null);
          initSuspenseListRenderState(
            workInProgress2,
            false,
            revealOrder,
            renderLanes2,
            tailMode,
            nextProps
          );
          break;
        case "backwards":
        case "unstable_legacy-backwards":
          renderLanes2 = null;
          revealOrder = workInProgress2.child;
          for (workInProgress2.child = null; null !== revealOrder; ) {
            current2 = revealOrder.alternate;
            if (null !== current2 && null === findFirstSuspended(current2)) {
              workInProgress2.child = revealOrder;
              break;
            }
            current2 = revealOrder.sibling;
            revealOrder.sibling = renderLanes2;
            renderLanes2 = revealOrder;
            revealOrder = current2;
          }
          initSuspenseListRenderState(
            workInProgress2,
            true,
            renderLanes2,
            null,
            tailMode,
            nextProps
          );
          break;
        case "together":
          initSuspenseListRenderState(
            workInProgress2,
            false,
            null,
            null,
            void 0,
            nextProps
          );
          break;
        default:
          workInProgress2.memoizedState = null;
      }
      return workInProgress2.child;
    }
    function bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2) {
      null !== current2 && (workInProgress2.dependencies = current2.dependencies);
      workInProgressRootSkippedLanes |= workInProgress2.lanes;
      if (0 === (renderLanes2 & workInProgress2.childLanes))
        if (null !== current2) {
          if (propagateParentContextChanges(
            current2,
            workInProgress2,
            renderLanes2,
            false
          ), 0 === (renderLanes2 & workInProgress2.childLanes))
            return null;
        } else return null;
      if (null !== current2 && workInProgress2.child !== current2.child)
        throw Error(formatProdErrorMessage(153));
      if (null !== workInProgress2.child) {
        current2 = workInProgress2.child;
        renderLanes2 = createWorkInProgress(current2, current2.pendingProps);
        workInProgress2.child = renderLanes2;
        for (renderLanes2.return = workInProgress2; null !== current2.sibling; )
          current2 = current2.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current2, current2.pendingProps), renderLanes2.return = workInProgress2;
        renderLanes2.sibling = null;
      }
      return workInProgress2.child;
    }
    function checkScheduledUpdateOrContext(current2, renderLanes2) {
      if (0 !== (current2.lanes & renderLanes2)) return true;
      current2 = current2.dependencies;
      return null !== current2 && checkIfContextChanged(current2) ? true : false;
    }
    function attemptEarlyBailoutIfNoScheduledUpdate(current2, workInProgress2, renderLanes2) {
      switch (workInProgress2.tag) {
        case 3:
          pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
          pushProvider(workInProgress2, CacheContext, current2.memoizedState.cache);
          resetHydrationState();
          break;
        case 27:
        case 5:
          pushHostContext(workInProgress2);
          break;
        case 4:
          pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
          break;
        case 10:
          pushProvider(
            workInProgress2,
            workInProgress2.type,
            workInProgress2.memoizedProps.value
          );
          break;
        case 31:
          if (null !== workInProgress2.memoizedState)
            return workInProgress2.flags |= 128, pushDehydratedActivitySuspenseHandler(workInProgress2), null;
          break;
        case 13:
          var state$102 = workInProgress2.memoizedState;
          if (null !== state$102) {
            if (null !== state$102.dehydrated)
              return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags |= 128, null;
            if (0 !== (renderLanes2 & workInProgress2.child.childLanes))
              return updateSuspenseComponent(current2, workInProgress2, renderLanes2);
            pushPrimaryTreeSuspenseHandler(workInProgress2);
            current2 = bailoutOnAlreadyFinishedWork(
              current2,
              workInProgress2,
              renderLanes2
            );
            return null !== current2 ? current2.sibling : null;
          }
          pushPrimaryTreeSuspenseHandler(workInProgress2);
          break;
        case 19:
          var didSuspendBefore = 0 !== (current2.flags & 128);
          state$102 = 0 !== (renderLanes2 & workInProgress2.childLanes);
          state$102 || (propagateParentContextChanges(
            current2,
            workInProgress2,
            renderLanes2,
            false
          ), state$102 = 0 !== (renderLanes2 & workInProgress2.childLanes));
          if (didSuspendBefore) {
            if (state$102)
              return updateSuspenseListComponent(
                current2,
                workInProgress2,
                renderLanes2
              );
            workInProgress2.flags |= 128;
          }
          didSuspendBefore = workInProgress2.memoizedState;
          null !== didSuspendBefore && (didSuspendBefore.rendering = null, didSuspendBefore.tail = null, didSuspendBefore.lastEffect = null);
          push(suspenseStackCursor, suspenseStackCursor.current);
          if (state$102) break;
          else return null;
        case 22:
          return workInProgress2.lanes = 0, updateOffscreenComponent(
            current2,
            workInProgress2,
            renderLanes2,
            workInProgress2.pendingProps
          );
        case 24:
          pushProvider(workInProgress2, CacheContext, current2.memoizedState.cache);
      }
      return bailoutOnAlreadyFinishedWork(current2, workInProgress2, renderLanes2);
    }
    function beginWork(current2, workInProgress2, renderLanes2) {
      if (null !== current2)
        if (current2.memoizedProps !== workInProgress2.pendingProps)
          didReceiveUpdate = true;
        else {
          if (!checkScheduledUpdateOrContext(current2, renderLanes2) && 0 === (workInProgress2.flags & 128))
            return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(
              current2,
              workInProgress2,
              renderLanes2
            );
          didReceiveUpdate = 0 !== (current2.flags & 131072) ? true : false;
        }
      else
        didReceiveUpdate = false, isHydrating && 0 !== (workInProgress2.flags & 1048576) && pushTreeId(workInProgress2, treeForkCount, workInProgress2.index);
      workInProgress2.lanes = 0;
      switch (workInProgress2.tag) {
        case 16:
          a: {
            var props = workInProgress2.pendingProps;
            current2 = resolveLazy(workInProgress2.elementType);
            workInProgress2.type = current2;
            if ("function" === typeof current2)
              shouldConstruct(current2) ? (props = resolveClassComponentProps(current2, props), workInProgress2.tag = 1, workInProgress2 = updateClassComponent(
                null,
                workInProgress2,
                current2,
                props,
                renderLanes2
              )) : (workInProgress2.tag = 0, workInProgress2 = updateFunctionComponent(
                null,
                workInProgress2,
                current2,
                props,
                renderLanes2
              ));
            else {
              if (void 0 !== current2 && null !== current2) {
                var $$typeof = current2.$$typeof;
                if ($$typeof === REACT_FORWARD_REF_TYPE) {
                  workInProgress2.tag = 11;
                  workInProgress2 = updateForwardRef(
                    null,
                    workInProgress2,
                    current2,
                    props,
                    renderLanes2
                  );
                  break a;
                } else if ($$typeof === REACT_MEMO_TYPE) {
                  workInProgress2.tag = 14;
                  workInProgress2 = updateMemoComponent(
                    null,
                    workInProgress2,
                    current2,
                    props,
                    renderLanes2
                  );
                  break a;
                }
              }
              workInProgress2 = getComponentNameFromType(current2) || current2;
              throw Error(formatProdErrorMessage(306, workInProgress2, ""));
            }
          }
          return workInProgress2;
        case 0:
          return updateFunctionComponent(
            current2,
            workInProgress2,
            workInProgress2.type,
            workInProgress2.pendingProps,
            renderLanes2
          );
        case 1:
          return props = workInProgress2.type, $$typeof = resolveClassComponentProps(
            props,
            workInProgress2.pendingProps
          ), updateClassComponent(
            current2,
            workInProgress2,
            props,
            $$typeof,
            renderLanes2
          );
        case 3:
          a: {
            pushHostContainer(
              workInProgress2,
              workInProgress2.stateNode.containerInfo
            );
            if (null === current2) throw Error(formatProdErrorMessage(387));
            props = workInProgress2.pendingProps;
            var prevState = workInProgress2.memoizedState;
            $$typeof = prevState.element;
            cloneUpdateQueue(current2, workInProgress2);
            processUpdateQueue(workInProgress2, props, null, renderLanes2);
            var nextState = workInProgress2.memoizedState;
            props = nextState.cache;
            pushProvider(workInProgress2, CacheContext, props);
            props !== prevState.cache && propagateContextChanges(
              workInProgress2,
              [CacheContext],
              renderLanes2,
              true
            );
            suspendIfUpdateReadFromEntangledAsyncAction();
            props = nextState.element;
            if (prevState.isDehydrated)
              if (prevState = {
                element: props,
                isDehydrated: false,
                cache: nextState.cache
              }, workInProgress2.updateQueue.baseState = prevState, workInProgress2.memoizedState = prevState, workInProgress2.flags & 256) {
                workInProgress2 = mountHostRootWithoutHydrating(
                  current2,
                  workInProgress2,
                  props,
                  renderLanes2
                );
                break a;
              } else if (props !== $$typeof) {
                $$typeof = createCapturedValueAtFiber(
                  Error(formatProdErrorMessage(424)),
                  workInProgress2
                );
                queueHydrationError($$typeof);
                workInProgress2 = mountHostRootWithoutHydrating(
                  current2,
                  workInProgress2,
                  props,
                  renderLanes2
                );
                break a;
              } else {
                current2 = workInProgress2.stateNode.containerInfo;
                switch (current2.nodeType) {
                  case 9:
                    current2 = current2.body;
                    break;
                  default:
                    current2 = "HTML" === current2.nodeName ? current2.ownerDocument.body : current2;
                }
                nextHydratableInstance = getNextHydratable(current2.firstChild);
                hydrationParentFiber = workInProgress2;
                isHydrating = true;
                hydrationErrors = null;
                rootOrSingletonContext = true;
                renderLanes2 = mountChildFibers(
                  workInProgress2,
                  null,
                  props,
                  renderLanes2
                );
                for (workInProgress2.child = renderLanes2; renderLanes2; )
                  renderLanes2.flags = renderLanes2.flags & -3 | 4096, renderLanes2 = renderLanes2.sibling;
              }
            else {
              resetHydrationState();
              if (props === $$typeof) {
                workInProgress2 = bailoutOnAlreadyFinishedWork(
                  current2,
                  workInProgress2,
                  renderLanes2
                );
                break a;
              }
              reconcileChildren(current2, workInProgress2, props, renderLanes2);
            }
            workInProgress2 = workInProgress2.child;
          }
          return workInProgress2;
        case 26:
          return markRef(current2, workInProgress2), null === current2 ? (renderLanes2 = getResource(
            workInProgress2.type,
            null,
            workInProgress2.pendingProps,
            null
          )) ? workInProgress2.memoizedState = renderLanes2 : isHydrating || (renderLanes2 = workInProgress2.type, current2 = workInProgress2.pendingProps, props = getOwnerDocumentFromRootContainer(
            rootInstanceStackCursor.current
          ).createElement(renderLanes2), props[internalInstanceKey] = workInProgress2, props[internalPropsKey] = current2, setInitialProperties(props, renderLanes2, current2), markNodeAsHoistable(props), workInProgress2.stateNode = props) : workInProgress2.memoizedState = getResource(
            workInProgress2.type,
            current2.memoizedProps,
            workInProgress2.pendingProps,
            current2.memoizedState
          ), null;
        case 27:
          return pushHostContext(workInProgress2), null === current2 && isHydrating && (props = workInProgress2.stateNode = resolveSingletonInstance(
            workInProgress2.type,
            workInProgress2.pendingProps,
            rootInstanceStackCursor.current
          ), hydrationParentFiber = workInProgress2, rootOrSingletonContext = true, $$typeof = nextHydratableInstance, isSingletonScope(workInProgress2.type) ? (previousHydratableOnEnteringScopedSingleton = $$typeof, nextHydratableInstance = getNextHydratable(props.firstChild)) : nextHydratableInstance = $$typeof), reconcileChildren(
            current2,
            workInProgress2,
            workInProgress2.pendingProps.children,
            renderLanes2
          ), markRef(current2, workInProgress2), null === current2 && (workInProgress2.flags |= 4194304), workInProgress2.child;
        case 5:
          if (null === current2 && isHydrating) {
            if ($$typeof = props = nextHydratableInstance)
              props = canHydrateInstance(
                props,
                workInProgress2.type,
                workInProgress2.pendingProps,
                rootOrSingletonContext
              ), null !== props ? (workInProgress2.stateNode = props, hydrationParentFiber = workInProgress2, nextHydratableInstance = getNextHydratable(props.firstChild), rootOrSingletonContext = false, $$typeof = true) : $$typeof = false;
            $$typeof || throwOnHydrationMismatch(workInProgress2);
          }
          pushHostContext(workInProgress2);
          $$typeof = workInProgress2.type;
          prevState = workInProgress2.pendingProps;
          nextState = null !== current2 ? current2.memoizedProps : null;
          props = prevState.children;
          shouldSetTextContent($$typeof, prevState) ? props = null : null !== nextState && shouldSetTextContent($$typeof, nextState) && (workInProgress2.flags |= 32);
          null !== workInProgress2.memoizedState && ($$typeof = renderWithHooks(
            current2,
            workInProgress2,
            TransitionAwareHostComponent,
            null,
            null,
            renderLanes2
          ), HostTransitionContext._currentValue = $$typeof);
          markRef(current2, workInProgress2);
          reconcileChildren(current2, workInProgress2, props, renderLanes2);
          return workInProgress2.child;
        case 6:
          if (null === current2 && isHydrating) {
            if (current2 = renderLanes2 = nextHydratableInstance)
              renderLanes2 = canHydrateTextInstance(
                renderLanes2,
                workInProgress2.pendingProps,
                rootOrSingletonContext
              ), null !== renderLanes2 ? (workInProgress2.stateNode = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, current2 = true) : current2 = false;
            current2 || throwOnHydrationMismatch(workInProgress2);
          }
          return null;
        case 13:
          return updateSuspenseComponent(current2, workInProgress2, renderLanes2);
        case 4:
          return pushHostContainer(
            workInProgress2,
            workInProgress2.stateNode.containerInfo
          ), props = workInProgress2.pendingProps, null === current2 ? workInProgress2.child = reconcileChildFibers(
            workInProgress2,
            null,
            props,
            renderLanes2
          ) : reconcileChildren(current2, workInProgress2, props, renderLanes2), workInProgress2.child;
        case 11:
          return updateForwardRef(
            current2,
            workInProgress2,
            workInProgress2.type,
            workInProgress2.pendingProps,
            renderLanes2
          );
        case 7:
          return reconcileChildren(
            current2,
            workInProgress2,
            workInProgress2.pendingProps,
            renderLanes2
          ), workInProgress2.child;
        case 8:
          return reconcileChildren(
            current2,
            workInProgress2,
            workInProgress2.pendingProps.children,
            renderLanes2
          ), workInProgress2.child;
        case 12:
          return reconcileChildren(
            current2,
            workInProgress2,
            workInProgress2.pendingProps.children,
            renderLanes2
          ), workInProgress2.child;
        case 10:
          return props = workInProgress2.pendingProps, pushProvider(workInProgress2, workInProgress2.type, props.value), reconcileChildren(current2, workInProgress2, props.children, renderLanes2), workInProgress2.child;
        case 9:
          return $$typeof = workInProgress2.type._context, props = workInProgress2.pendingProps.children, prepareToReadContext(workInProgress2), $$typeof = readContext($$typeof), props = props($$typeof), workInProgress2.flags |= 1, reconcileChildren(current2, workInProgress2, props, renderLanes2), workInProgress2.child;
        case 14:
          return updateMemoComponent(
            current2,
            workInProgress2,
            workInProgress2.type,
            workInProgress2.pendingProps,
            renderLanes2
          );
        case 15:
          return updateSimpleMemoComponent(
            current2,
            workInProgress2,
            workInProgress2.type,
            workInProgress2.pendingProps,
            renderLanes2
          );
        case 19:
          return updateSuspenseListComponent(current2, workInProgress2, renderLanes2);
        case 31:
          return updateActivityComponent(current2, workInProgress2, renderLanes2);
        case 22:
          return updateOffscreenComponent(
            current2,
            workInProgress2,
            renderLanes2,
            workInProgress2.pendingProps
          );
        case 24:
          return prepareToReadContext(workInProgress2), props = readContext(CacheContext), null === current2 ? ($$typeof = peekCacheFromPool(), null === $$typeof && ($$typeof = workInProgressRoot, prevState = createCache(), $$typeof.pooledCache = prevState, prevState.refCount++, null !== prevState && ($$typeof.pooledCacheLanes |= renderLanes2), $$typeof = prevState), workInProgress2.memoizedState = { parent: props, cache: $$typeof }, initializeUpdateQueue(workInProgress2), pushProvider(workInProgress2, CacheContext, $$typeof)) : (0 !== (current2.lanes & renderLanes2) && (cloneUpdateQueue(current2, workInProgress2), processUpdateQueue(workInProgress2, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), $$typeof = current2.memoizedState, prevState = workInProgress2.memoizedState, $$typeof.parent !== props ? ($$typeof = { parent: props, cache: props }, workInProgress2.memoizedState = $$typeof, 0 === workInProgress2.lanes && (workInProgress2.memoizedState = workInProgress2.updateQueue.baseState = $$typeof), pushProvider(workInProgress2, CacheContext, props)) : (props = prevState.cache, pushProvider(workInProgress2, CacheContext, props), props !== $$typeof.cache && propagateContextChanges(
            workInProgress2,
            [CacheContext],
            renderLanes2,
            true
          ))), reconcileChildren(
            current2,
            workInProgress2,
            workInProgress2.pendingProps.children,
            renderLanes2
          ), workInProgress2.child;
        case 29:
          throw workInProgress2.pendingProps;
      }
      throw Error(formatProdErrorMessage(156, workInProgress2.tag));
    }
    function markUpdate(workInProgress2) {
      workInProgress2.flags |= 4;
    }
    function preloadInstanceAndSuspendIfNeeded(workInProgress2, type, oldProps, newProps, renderLanes2) {
      if (type = 0 !== (workInProgress2.mode & 32)) type = false;
      if (type) {
        if (workInProgress2.flags |= 16777216, (renderLanes2 & 335544128) === renderLanes2)
          if (workInProgress2.stateNode.complete) workInProgress2.flags |= 8192;
          else if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
          else
            throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
      } else workInProgress2.flags &= -16777217;
    }
    function preloadResourceAndSuspendIfNeeded(workInProgress2, resource) {
      if ("stylesheet" !== resource.type || 0 !== (resource.state.loading & 4))
        workInProgress2.flags &= -16777217;
      else if (workInProgress2.flags |= 16777216, !preloadResource(resource))
        if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
        else
          throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
    }
    function scheduleRetryEffect(workInProgress2, retryQueue) {
      null !== retryQueue && (workInProgress2.flags |= 4);
      workInProgress2.flags & 16384 && (retryQueue = 22 !== workInProgress2.tag ? claimNextRetryLane() : 536870912, workInProgress2.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
    }
    function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
      if (!isHydrating)
        switch (renderState.tailMode) {
          case "hidden":
            hasRenderedATailFallback = renderState.tail;
            for (var lastTailNode = null; null !== hasRenderedATailFallback; )
              null !== hasRenderedATailFallback.alternate && (lastTailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
            null === lastTailNode ? renderState.tail = null : lastTailNode.sibling = null;
            break;
          case "collapsed":
            lastTailNode = renderState.tail;
            for (var lastTailNode$106 = null; null !== lastTailNode; )
              null !== lastTailNode.alternate && (lastTailNode$106 = lastTailNode), lastTailNode = lastTailNode.sibling;
            null === lastTailNode$106 ? hasRenderedATailFallback || null === renderState.tail ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode$106.sibling = null;
        }
    }
    function bubbleProperties(completedWork) {
      var didBailout = null !== completedWork.alternate && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
      if (didBailout)
        for (var child$107 = completedWork.child; null !== child$107; )
          newChildLanes |= child$107.lanes | child$107.childLanes, subtreeFlags |= child$107.subtreeFlags & 65011712, subtreeFlags |= child$107.flags & 65011712, child$107.return = completedWork, child$107 = child$107.sibling;
      else
        for (child$107 = completedWork.child; null !== child$107; )
          newChildLanes |= child$107.lanes | child$107.childLanes, subtreeFlags |= child$107.subtreeFlags, subtreeFlags |= child$107.flags, child$107.return = completedWork, child$107 = child$107.sibling;
      completedWork.subtreeFlags |= subtreeFlags;
      completedWork.childLanes = newChildLanes;
      return didBailout;
    }
    function completeWork(current2, workInProgress2, renderLanes2) {
      var newProps = workInProgress2.pendingProps;
      popTreeContext(workInProgress2);
      switch (workInProgress2.tag) {
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return bubbleProperties(workInProgress2), null;
        case 1:
          return bubbleProperties(workInProgress2), null;
        case 3:
          renderLanes2 = workInProgress2.stateNode;
          newProps = null;
          null !== current2 && (newProps = current2.memoizedState.cache);
          workInProgress2.memoizedState.cache !== newProps && (workInProgress2.flags |= 2048);
          popProvider(CacheContext);
          popHostContainer();
          renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
          if (null === current2 || null === current2.child)
            popHydrationState(workInProgress2) ? markUpdate(workInProgress2) : null === current2 || current2.memoizedState.isDehydrated && 0 === (workInProgress2.flags & 256) || (workInProgress2.flags |= 1024, upgradeHydrationErrorsToRecoverable());
          bubbleProperties(workInProgress2);
          return null;
        case 26:
          var type = workInProgress2.type, nextResource = workInProgress2.memoizedState;
          null === current2 ? (markUpdate(workInProgress2), null !== nextResource ? (bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
            workInProgress2,
            type,
            null,
            newProps,
            renderLanes2
          ))) : nextResource ? nextResource !== current2.memoizedState ? (markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217) : (current2 = current2.memoizedProps, current2 !== newProps && markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
            workInProgress2,
            type,
            current2,
            newProps,
            renderLanes2
          ));
          return null;
        case 27:
          popHostContext(workInProgress2);
          renderLanes2 = rootInstanceStackCursor.current;
          type = workInProgress2.type;
          if (null !== current2 && null != workInProgress2.stateNode)
            current2.memoizedProps !== newProps && markUpdate(workInProgress2);
          else {
            if (!newProps) {
              if (null === workInProgress2.stateNode)
                throw Error(formatProdErrorMessage(166));
              bubbleProperties(workInProgress2);
              return null;
            }
            current2 = contextStackCursor.current;
            popHydrationState(workInProgress2) ? prepareToHydrateHostInstance(workInProgress2, current2) : (current2 = resolveSingletonInstance(type, newProps, renderLanes2), workInProgress2.stateNode = current2, markUpdate(workInProgress2));
          }
          bubbleProperties(workInProgress2);
          return null;
        case 5:
          popHostContext(workInProgress2);
          type = workInProgress2.type;
          if (null !== current2 && null != workInProgress2.stateNode)
            current2.memoizedProps !== newProps && markUpdate(workInProgress2);
          else {
            if (!newProps) {
              if (null === workInProgress2.stateNode)
                throw Error(formatProdErrorMessage(166));
              bubbleProperties(workInProgress2);
              return null;
            }
            nextResource = contextStackCursor.current;
            if (popHydrationState(workInProgress2))
              prepareToHydrateHostInstance(workInProgress2, nextResource);
            else {
              var ownerDocument = getOwnerDocumentFromRootContainer(
                rootInstanceStackCursor.current
              );
              switch (nextResource) {
                case 1:
                  nextResource = ownerDocument.createElementNS(
                    "http://www.w3.org/2000/svg",
                    type
                  );
                  break;
                case 2:
                  nextResource = ownerDocument.createElementNS(
                    "http://www.w3.org/1998/Math/MathML",
                    type
                  );
                  break;
                default:
                  switch (type) {
                    case "svg":
                      nextResource = ownerDocument.createElementNS(
                        "http://www.w3.org/2000/svg",
                        type
                      );
                      break;
                    case "math":
                      nextResource = ownerDocument.createElementNS(
                        "http://www.w3.org/1998/Math/MathML",
                        type
                      );
                      break;
                    case "script":
                      nextResource = ownerDocument.createElement("div");
                      nextResource.innerHTML = "<script><\/script>";
                      nextResource = nextResource.removeChild(
                        nextResource.firstChild
                      );
                      break;
                    case "select":
                      nextResource = "string" === typeof newProps.is ? ownerDocument.createElement("select", {
                        is: newProps.is
                      }) : ownerDocument.createElement("select");
                      newProps.multiple ? nextResource.multiple = true : newProps.size && (nextResource.size = newProps.size);
                      break;
                    default:
                      nextResource = "string" === typeof newProps.is ? ownerDocument.createElement(type, { is: newProps.is }) : ownerDocument.createElement(type);
                  }
              }
              nextResource[internalInstanceKey] = workInProgress2;
              nextResource[internalPropsKey] = newProps;
              a: for (ownerDocument = workInProgress2.child; null !== ownerDocument; ) {
                if (5 === ownerDocument.tag || 6 === ownerDocument.tag)
                  nextResource.appendChild(ownerDocument.stateNode);
                else if (4 !== ownerDocument.tag && 27 !== ownerDocument.tag && null !== ownerDocument.child) {
                  ownerDocument.child.return = ownerDocument;
                  ownerDocument = ownerDocument.child;
                  continue;
                }
                if (ownerDocument === workInProgress2) break a;
                for (; null === ownerDocument.sibling; ) {
                  if (null === ownerDocument.return || ownerDocument.return === workInProgress2)
                    break a;
                  ownerDocument = ownerDocument.return;
                }
                ownerDocument.sibling.return = ownerDocument.return;
                ownerDocument = ownerDocument.sibling;
              }
              workInProgress2.stateNode = nextResource;
              a: switch (setInitialProperties(nextResource, type, newProps), type) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  newProps = !!newProps.autoFocus;
                  break a;
                case "img":
                  newProps = true;
                  break a;
                default:
                  newProps = false;
              }
              newProps && markUpdate(workInProgress2);
            }
          }
          bubbleProperties(workInProgress2);
          preloadInstanceAndSuspendIfNeeded(
            workInProgress2,
            workInProgress2.type,
            null === current2 ? null : current2.memoizedProps,
            workInProgress2.pendingProps,
            renderLanes2
          );
          return null;
        case 6:
          if (current2 && null != workInProgress2.stateNode)
            current2.memoizedProps !== newProps && markUpdate(workInProgress2);
          else {
            if ("string" !== typeof newProps && null === workInProgress2.stateNode)
              throw Error(formatProdErrorMessage(166));
            current2 = rootInstanceStackCursor.current;
            if (popHydrationState(workInProgress2)) {
              current2 = workInProgress2.stateNode;
              renderLanes2 = workInProgress2.memoizedProps;
              newProps = null;
              type = hydrationParentFiber;
              if (null !== type)
                switch (type.tag) {
                  case 27:
                  case 5:
                    newProps = type.memoizedProps;
                }
              current2[internalInstanceKey] = workInProgress2;
              current2 = current2.nodeValue === renderLanes2 || null !== newProps && true === newProps.suppressHydrationWarning || checkForUnmatchedText(current2.nodeValue, renderLanes2) ? true : false;
              current2 || throwOnHydrationMismatch(workInProgress2, true);
            } else
              current2 = getOwnerDocumentFromRootContainer(current2).createTextNode(
                newProps
              ), current2[internalInstanceKey] = workInProgress2, workInProgress2.stateNode = current2;
          }
          bubbleProperties(workInProgress2);
          return null;
        case 31:
          renderLanes2 = workInProgress2.memoizedState;
          if (null === current2 || null !== current2.memoizedState) {
            newProps = popHydrationState(workInProgress2);
            if (null !== renderLanes2) {
              if (null === current2) {
                if (!newProps) throw Error(formatProdErrorMessage(318));
                current2 = workInProgress2.memoizedState;
                current2 = null !== current2 ? current2.dehydrated : null;
                if (!current2) throw Error(formatProdErrorMessage(557));
                current2[internalInstanceKey] = workInProgress2;
              } else
                resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
              bubbleProperties(workInProgress2);
              current2 = false;
            } else
              renderLanes2 = upgradeHydrationErrorsToRecoverable(), null !== current2 && null !== current2.memoizedState && (current2.memoizedState.hydrationErrors = renderLanes2), current2 = true;
            if (!current2) {
              if (workInProgress2.flags & 256)
                return popSuspenseHandler(workInProgress2), workInProgress2;
              popSuspenseHandler(workInProgress2);
              return null;
            }
            if (0 !== (workInProgress2.flags & 128))
              throw Error(formatProdErrorMessage(558));
          }
          bubbleProperties(workInProgress2);
          return null;
        case 13:
          newProps = workInProgress2.memoizedState;
          if (null === current2 || null !== current2.memoizedState && null !== current2.memoizedState.dehydrated) {
            type = popHydrationState(workInProgress2);
            if (null !== newProps && null !== newProps.dehydrated) {
              if (null === current2) {
                if (!type) throw Error(formatProdErrorMessage(318));
                type = workInProgress2.memoizedState;
                type = null !== type ? type.dehydrated : null;
                if (!type) throw Error(formatProdErrorMessage(317));
                type[internalInstanceKey] = workInProgress2;
              } else
                resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
              bubbleProperties(workInProgress2);
              type = false;
            } else
              type = upgradeHydrationErrorsToRecoverable(), null !== current2 && null !== current2.memoizedState && (current2.memoizedState.hydrationErrors = type), type = true;
            if (!type) {
              if (workInProgress2.flags & 256)
                return popSuspenseHandler(workInProgress2), workInProgress2;
              popSuspenseHandler(workInProgress2);
              return null;
            }
          }
          popSuspenseHandler(workInProgress2);
          if (0 !== (workInProgress2.flags & 128))
            return workInProgress2.lanes = renderLanes2, workInProgress2;
          renderLanes2 = null !== newProps;
          current2 = null !== current2 && null !== current2.memoizedState;
          renderLanes2 && (newProps = workInProgress2.child, type = null, null !== newProps.alternate && null !== newProps.alternate.memoizedState && null !== newProps.alternate.memoizedState.cachePool && (type = newProps.alternate.memoizedState.cachePool.pool), nextResource = null, null !== newProps.memoizedState && null !== newProps.memoizedState.cachePool && (nextResource = newProps.memoizedState.cachePool.pool), nextResource !== type && (newProps.flags |= 2048));
          renderLanes2 !== current2 && renderLanes2 && (workInProgress2.child.flags |= 8192);
          scheduleRetryEffect(workInProgress2, workInProgress2.updateQueue);
          bubbleProperties(workInProgress2);
          return null;
        case 4:
          return popHostContainer(), null === current2 && listenToAllSupportedEvents(workInProgress2.stateNode.containerInfo), bubbleProperties(workInProgress2), null;
        case 10:
          return popProvider(workInProgress2.type), bubbleProperties(workInProgress2), null;
        case 19:
          pop(suspenseStackCursor);
          newProps = workInProgress2.memoizedState;
          if (null === newProps) return bubbleProperties(workInProgress2), null;
          type = 0 !== (workInProgress2.flags & 128);
          nextResource = newProps.rendering;
          if (null === nextResource)
            if (type) cutOffTailIfNeeded(newProps, false);
            else {
              if (0 !== workInProgressRootExitStatus || null !== current2 && 0 !== (current2.flags & 128))
                for (current2 = workInProgress2.child; null !== current2; ) {
                  nextResource = findFirstSuspended(current2);
                  if (null !== nextResource) {
                    workInProgress2.flags |= 128;
                    cutOffTailIfNeeded(newProps, false);
                    current2 = nextResource.updateQueue;
                    workInProgress2.updateQueue = current2;
                    scheduleRetryEffect(workInProgress2, current2);
                    workInProgress2.subtreeFlags = 0;
                    current2 = renderLanes2;
                    for (renderLanes2 = workInProgress2.child; null !== renderLanes2; )
                      resetWorkInProgress(renderLanes2, current2), renderLanes2 = renderLanes2.sibling;
                    push(
                      suspenseStackCursor,
                      suspenseStackCursor.current & 1 | 2
                    );
                    isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount);
                    return workInProgress2.child;
                  }
                  current2 = current2.sibling;
                }
              null !== newProps.tail && now() > workInProgressRootRenderTargetTime && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
            }
          else {
            if (!type)
              if (current2 = findFirstSuspended(nextResource), null !== current2) {
                if (workInProgress2.flags |= 128, type = true, current2 = current2.updateQueue, workInProgress2.updateQueue = current2, scheduleRetryEffect(workInProgress2, current2), cutOffTailIfNeeded(newProps, true), null === newProps.tail && "hidden" === newProps.tailMode && !nextResource.alternate && !isHydrating)
                  return bubbleProperties(workInProgress2), null;
              } else
                2 * now() - newProps.renderingStartTime > workInProgressRootRenderTargetTime && 536870912 !== renderLanes2 && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
            newProps.isBackwards ? (nextResource.sibling = workInProgress2.child, workInProgress2.child = nextResource) : (current2 = newProps.last, null !== current2 ? current2.sibling = nextResource : workInProgress2.child = nextResource, newProps.last = nextResource);
          }
          if (null !== newProps.tail)
            return current2 = newProps.tail, newProps.rendering = current2, newProps.tail = current2.sibling, newProps.renderingStartTime = now(), current2.sibling = null, renderLanes2 = suspenseStackCursor.current, push(
              suspenseStackCursor,
              type ? renderLanes2 & 1 | 2 : renderLanes2 & 1
            ), isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount), current2;
          bubbleProperties(workInProgress2);
          return null;
        case 22:
        case 23:
          return popSuspenseHandler(workInProgress2), popHiddenContext(), newProps = null !== workInProgress2.memoizedState, null !== current2 ? null !== current2.memoizedState !== newProps && (workInProgress2.flags |= 8192) : newProps && (workInProgress2.flags |= 8192), newProps ? 0 !== (renderLanes2 & 536870912) && 0 === (workInProgress2.flags & 128) && (bubbleProperties(workInProgress2), workInProgress2.subtreeFlags & 6 && (workInProgress2.flags |= 8192)) : bubbleProperties(workInProgress2), renderLanes2 = workInProgress2.updateQueue, null !== renderLanes2 && scheduleRetryEffect(workInProgress2, renderLanes2.retryQueue), renderLanes2 = null, null !== current2 && null !== current2.memoizedState && null !== current2.memoizedState.cachePool && (renderLanes2 = current2.memoizedState.cachePool.pool), newProps = null, null !== workInProgress2.memoizedState && null !== workInProgress2.memoizedState.cachePool && (newProps = workInProgress2.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress2.flags |= 2048), null !== current2 && pop(resumedCache), null;
        case 24:
          return renderLanes2 = null, null !== current2 && (renderLanes2 = current2.memoizedState.cache), workInProgress2.memoizedState.cache !== renderLanes2 && (workInProgress2.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress2), null;
        case 25:
          return null;
        case 30:
          return null;
      }
      throw Error(formatProdErrorMessage(156, workInProgress2.tag));
    }
    function unwindWork(current2, workInProgress2) {
      popTreeContext(workInProgress2);
      switch (workInProgress2.tag) {
        case 1:
          return current2 = workInProgress2.flags, current2 & 65536 ? (workInProgress2.flags = current2 & -65537 | 128, workInProgress2) : null;
        case 3:
          return popProvider(CacheContext), popHostContainer(), current2 = workInProgress2.flags, 0 !== (current2 & 65536) && 0 === (current2 & 128) ? (workInProgress2.flags = current2 & -65537 | 128, workInProgress2) : null;
        case 26:
        case 27:
        case 5:
          return popHostContext(workInProgress2), null;
        case 31:
          if (null !== workInProgress2.memoizedState) {
            popSuspenseHandler(workInProgress2);
            if (null === workInProgress2.alternate)
              throw Error(formatProdErrorMessage(340));
            resetHydrationState();
          }
          current2 = workInProgress2.flags;
          return current2 & 65536 ? (workInProgress2.flags = current2 & -65537 | 128, workInProgress2) : null;
        case 13:
          popSuspenseHandler(workInProgress2);
          current2 = workInProgress2.memoizedState;
          if (null !== current2 && null !== current2.dehydrated) {
            if (null === workInProgress2.alternate)
              throw Error(formatProdErrorMessage(340));
            resetHydrationState();
          }
          current2 = workInProgress2.flags;
          return current2 & 65536 ? (workInProgress2.flags = current2 & -65537 | 128, workInProgress2) : null;
        case 19:
          return pop(suspenseStackCursor), null;
        case 4:
          return popHostContainer(), null;
        case 10:
          return popProvider(workInProgress2.type), null;
        case 22:
        case 23:
          return popSuspenseHandler(workInProgress2), popHiddenContext(), null !== current2 && pop(resumedCache), current2 = workInProgress2.flags, current2 & 65536 ? (workInProgress2.flags = current2 & -65537 | 128, workInProgress2) : null;
        case 24:
          return popProvider(CacheContext), null;
        case 25:
          return null;
        default:
          return null;
      }
    }
    function unwindInterruptedWork(current2, interruptedWork) {
      popTreeContext(interruptedWork);
      switch (interruptedWork.tag) {
        case 3:
          popProvider(CacheContext);
          popHostContainer();
          break;
        case 26:
        case 27:
        case 5:
          popHostContext(interruptedWork);
          break;
        case 4:
          popHostContainer();
          break;
        case 31:
          null !== interruptedWork.memoizedState && popSuspenseHandler(interruptedWork);
          break;
        case 13:
          popSuspenseHandler(interruptedWork);
          break;
        case 19:
          pop(suspenseStackCursor);
          break;
        case 10:
          popProvider(interruptedWork.type);
          break;
        case 22:
        case 23:
          popSuspenseHandler(interruptedWork);
          popHiddenContext();
          null !== current2 && pop(resumedCache);
          break;
        case 24:
          popProvider(CacheContext);
      }
    }
    function commitHookEffectListMount(flags, finishedWork) {
      try {
        var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
        if (null !== lastEffect) {
          var firstEffect = lastEffect.next;
          updateQueue = firstEffect;
          do {
            if ((updateQueue.tag & flags) === flags) {
              lastEffect = void 0;
              var create2 = updateQueue.create, inst = updateQueue.inst;
              lastEffect = create2();
              inst.destroy = lastEffect;
            }
            updateQueue = updateQueue.next;
          } while (updateQueue !== firstEffect);
        }
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
    function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
      try {
        var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
        if (null !== lastEffect) {
          var firstEffect = lastEffect.next;
          updateQueue = firstEffect;
          do {
            if ((updateQueue.tag & flags) === flags) {
              var inst = updateQueue.inst, destroy = inst.destroy;
              if (void 0 !== destroy) {
                inst.destroy = void 0;
                lastEffect = finishedWork;
                var nearestMountedAncestor = nearestMountedAncestor$jscomp$0, destroy_ = destroy;
                try {
                  destroy_();
                } catch (error) {
                  captureCommitPhaseError(
                    lastEffect,
                    nearestMountedAncestor,
                    error
                  );
                }
              }
            }
            updateQueue = updateQueue.next;
          } while (updateQueue !== firstEffect);
        }
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
    function commitClassCallbacks(finishedWork) {
      var updateQueue = finishedWork.updateQueue;
      if (null !== updateQueue) {
        var instance = finishedWork.stateNode;
        try {
          commitCallbacks(updateQueue, instance);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
    }
    function safelyCallComponentWillUnmount(current2, nearestMountedAncestor, instance) {
      instance.props = resolveClassComponentProps(
        current2.type,
        current2.memoizedProps
      );
      instance.state = current2.memoizedState;
      try {
        instance.componentWillUnmount();
      } catch (error) {
        captureCommitPhaseError(current2, nearestMountedAncestor, error);
      }
    }
    function safelyAttachRef(current2, nearestMountedAncestor) {
      try {
        var ref = current2.ref;
        if (null !== ref) {
          switch (current2.tag) {
            case 26:
            case 27:
            case 5:
              var instanceToUse = current2.stateNode;
              break;
            case 30:
              instanceToUse = current2.stateNode;
              break;
            default:
              instanceToUse = current2.stateNode;
          }
          "function" === typeof ref ? current2.refCleanup = ref(instanceToUse) : ref.current = instanceToUse;
        }
      } catch (error) {
        captureCommitPhaseError(current2, nearestMountedAncestor, error);
      }
    }
    function safelyDetachRef(current2, nearestMountedAncestor) {
      var ref = current2.ref, refCleanup = current2.refCleanup;
      if (null !== ref)
        if ("function" === typeof refCleanup)
          try {
            refCleanup();
          } catch (error) {
            captureCommitPhaseError(current2, nearestMountedAncestor, error);
          } finally {
            current2.refCleanup = null, current2 = current2.alternate, null != current2 && (current2.refCleanup = null);
          }
        else if ("function" === typeof ref)
          try {
            ref(null);
          } catch (error$140) {
            captureCommitPhaseError(current2, nearestMountedAncestor, error$140);
          }
        else ref.current = null;
    }
    function commitHostMount(finishedWork) {
      var type = finishedWork.type, props = finishedWork.memoizedProps, instance = finishedWork.stateNode;
      try {
        a: switch (type) {
          case "button":
          case "input":
          case "select":
          case "textarea":
            props.autoFocus && instance.focus();
            break a;
          case "img":
            props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
        }
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
    function commitHostUpdate(finishedWork, newProps, oldProps) {
      try {
        var domElement = finishedWork.stateNode;
        updateProperties(domElement, finishedWork.type, oldProps, newProps);
        domElement[internalPropsKey] = newProps;
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
    function isHostParent(fiber) {
      return 5 === fiber.tag || 3 === fiber.tag || 26 === fiber.tag || 27 === fiber.tag && isSingletonScope(fiber.type) || 4 === fiber.tag;
    }
    function getHostSibling(fiber) {
      a: for (; ; ) {
        for (; null === fiber.sibling; ) {
          if (null === fiber.return || isHostParent(fiber.return)) return null;
          fiber = fiber.return;
        }
        fiber.sibling.return = fiber.return;
        for (fiber = fiber.sibling; 5 !== fiber.tag && 6 !== fiber.tag && 18 !== fiber.tag; ) {
          if (27 === fiber.tag && isSingletonScope(fiber.type)) continue a;
          if (fiber.flags & 2) continue a;
          if (null === fiber.child || 4 === fiber.tag) continue a;
          else fiber.child.return = fiber, fiber = fiber.child;
        }
        if (!(fiber.flags & 2)) return fiber.stateNode;
      }
    }
    function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
      var tag = node.tag;
      if (5 === tag || 6 === tag)
        node = node.stateNode, before ? (9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent).insertBefore(node, before) : (before = 9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent, before.appendChild(node), parent = parent._reactRootContainer, null !== parent && void 0 !== parent || null !== before.onclick || (before.onclick = noop$1));
      else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode, before = null), node = node.child, null !== node))
        for (insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling; null !== node; )
          insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;
    }
    function insertOrAppendPlacementNode(node, before, parent) {
      var tag = node.tag;
      if (5 === tag || 6 === tag)
        node = node.stateNode, before ? parent.insertBefore(node, before) : parent.appendChild(node);
      else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode), node = node.child, null !== node))
        for (insertOrAppendPlacementNode(node, before, parent), node = node.sibling; null !== node; )
          insertOrAppendPlacementNode(node, before, parent), node = node.sibling;
    }
    function commitHostSingletonAcquisition(finishedWork) {
      var singleton = finishedWork.stateNode, props = finishedWork.memoizedProps;
      try {
        for (var type = finishedWork.type, attributes = singleton.attributes; attributes.length; )
          singleton.removeAttributeNode(attributes[0]);
        setInitialProperties(singleton, type, props);
        singleton[internalInstanceKey] = finishedWork;
        singleton[internalPropsKey] = props;
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
    var offscreenSubtreeIsHidden = false;
    var offscreenSubtreeWasHidden = false;
    var needsFormReset = false;
    var PossiblyWeakSet = "function" === typeof WeakSet ? WeakSet : Set;
    var nextEffect = null;
    function commitBeforeMutationEffects(root2, firstChild) {
      root2 = root2.containerInfo;
      eventsEnabled = _enabled;
      root2 = getActiveElementDeep(root2);
      if (hasSelectionCapabilities(root2)) {
        if ("selectionStart" in root2)
          var JSCompiler_temp = {
            start: root2.selectionStart,
            end: root2.selectionEnd
          };
        else
          a: {
            JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
            var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
            if (selection && 0 !== selection.rangeCount) {
              JSCompiler_temp = selection.anchorNode;
              var anchorOffset = selection.anchorOffset, focusNode = selection.focusNode;
              selection = selection.focusOffset;
              try {
                JSCompiler_temp.nodeType, focusNode.nodeType;
              } catch (e$20) {
                JSCompiler_temp = null;
                break a;
              }
              var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
              b: for (; ; ) {
                for (var next; ; ) {
                  node !== JSCompiler_temp || 0 !== anchorOffset && 3 !== node.nodeType || (start = length + anchorOffset);
                  node !== focusNode || 0 !== selection && 3 !== node.nodeType || (end = length + selection);
                  3 === node.nodeType && (length += node.nodeValue.length);
                  if (null === (next = node.firstChild)) break;
                  parentNode = node;
                  node = next;
                }
                for (; ; ) {
                  if (node === root2) break b;
                  parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                  parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                  if (null !== (next = node.nextSibling)) break;
                  node = parentNode;
                  parentNode = node.parentNode;
                }
                node = next;
              }
              JSCompiler_temp = -1 === start || -1 === end ? null : { start, end };
            } else JSCompiler_temp = null;
          }
        JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
      } else JSCompiler_temp = null;
      selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
      _enabled = false;
      for (nextEffect = firstChild; null !== nextEffect; )
        if (firstChild = nextEffect, root2 = firstChild.child, 0 !== (firstChild.subtreeFlags & 1028) && null !== root2)
          root2.return = firstChild, nextEffect = root2;
        else
          for (; null !== nextEffect; ) {
            firstChild = nextEffect;
            focusNode = firstChild.alternate;
            root2 = firstChild.flags;
            switch (firstChild.tag) {
              case 0:
                if (0 !== (root2 & 4) && (root2 = firstChild.updateQueue, root2 = null !== root2 ? root2.events : null, null !== root2))
                  for (JSCompiler_temp = 0; JSCompiler_temp < root2.length; JSCompiler_temp++)
                    anchorOffset = root2[JSCompiler_temp], anchorOffset.ref.impl = anchorOffset.nextImpl;
                break;
              case 11:
              case 15:
                break;
              case 1:
                if (0 !== (root2 & 1024) && null !== focusNode) {
                  root2 = void 0;
                  JSCompiler_temp = firstChild;
                  anchorOffset = focusNode.memoizedProps;
                  focusNode = focusNode.memoizedState;
                  selection = JSCompiler_temp.stateNode;
                  try {
                    var resolvedPrevProps = resolveClassComponentProps(
                      JSCompiler_temp.type,
                      anchorOffset
                    );
                    root2 = selection.getSnapshotBeforeUpdate(
                      resolvedPrevProps,
                      focusNode
                    );
                    selection.__reactInternalSnapshotBeforeUpdate = root2;
                  } catch (error) {
                    captureCommitPhaseError(
                      JSCompiler_temp,
                      JSCompiler_temp.return,
                      error
                    );
                  }
                }
                break;
              case 3:
                if (0 !== (root2 & 1024)) {
                  if (root2 = firstChild.stateNode.containerInfo, JSCompiler_temp = root2.nodeType, 9 === JSCompiler_temp)
                    clearContainerSparingly(root2);
                  else if (1 === JSCompiler_temp)
                    switch (root2.nodeName) {
                      case "HEAD":
                      case "HTML":
                      case "BODY":
                        clearContainerSparingly(root2);
                        break;
                      default:
                        root2.textContent = "";
                    }
                }
                break;
              case 5:
              case 26:
              case 27:
              case 6:
              case 4:
              case 17:
                break;
              default:
                if (0 !== (root2 & 1024)) throw Error(formatProdErrorMessage(163));
            }
            root2 = firstChild.sibling;
            if (null !== root2) {
              root2.return = firstChild.return;
              nextEffect = root2;
              break;
            }
            nextEffect = firstChild.return;
          }
    }
    function commitLayoutEffectOnFiber(finishedRoot, current2, finishedWork) {
      var flags = finishedWork.flags;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 15:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          flags & 4 && commitHookEffectListMount(5, finishedWork);
          break;
        case 1:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          if (flags & 4)
            if (finishedRoot = finishedWork.stateNode, null === current2)
              try {
                finishedRoot.componentDidMount();
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            else {
              var prevProps = resolveClassComponentProps(
                finishedWork.type,
                current2.memoizedProps
              );
              current2 = current2.memoizedState;
              try {
                finishedRoot.componentDidUpdate(
                  prevProps,
                  current2,
                  finishedRoot.__reactInternalSnapshotBeforeUpdate
                );
              } catch (error$139) {
                captureCommitPhaseError(
                  finishedWork,
                  finishedWork.return,
                  error$139
                );
              }
            }
          flags & 64 && commitClassCallbacks(finishedWork);
          flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
          break;
        case 3:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          if (flags & 64 && (finishedRoot = finishedWork.updateQueue, null !== finishedRoot)) {
            current2 = null;
            if (null !== finishedWork.child)
              switch (finishedWork.child.tag) {
                case 27:
                case 5:
                  current2 = finishedWork.child.stateNode;
                  break;
                case 1:
                  current2 = finishedWork.child.stateNode;
              }
            try {
              commitCallbacks(finishedRoot, current2);
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          }
          break;
        case 27:
          null === current2 && flags & 4 && commitHostSingletonAcquisition(finishedWork);
        case 26:
        case 5:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          null === current2 && flags & 4 && commitHostMount(finishedWork);
          flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
          break;
        case 12:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          break;
        case 31:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
          break;
        case 13:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
          flags & 64 && (finishedRoot = finishedWork.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot && (finishedWork = retryDehydratedSuspenseBoundary.bind(
            null,
            finishedWork
          ), registerSuspenseInstanceRetry(finishedRoot, finishedWork))));
          break;
        case 22:
          flags = null !== finishedWork.memoizedState || offscreenSubtreeIsHidden;
          if (!flags) {
            current2 = null !== current2 && null !== current2.memoizedState || offscreenSubtreeWasHidden;
            prevProps = offscreenSubtreeIsHidden;
            var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
            offscreenSubtreeIsHidden = flags;
            (offscreenSubtreeWasHidden = current2) && !prevOffscreenSubtreeWasHidden ? recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              0 !== (finishedWork.subtreeFlags & 8772)
            ) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            offscreenSubtreeIsHidden = prevProps;
            offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
          }
          break;
        case 30:
          break;
        default:
          recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      }
    }
    function detachFiberAfterEffects(fiber) {
      var alternate = fiber.alternate;
      null !== alternate && (fiber.alternate = null, detachFiberAfterEffects(alternate));
      fiber.child = null;
      fiber.deletions = null;
      fiber.sibling = null;
      5 === fiber.tag && (alternate = fiber.stateNode, null !== alternate && detachDeletedInstance(alternate));
      fiber.stateNode = null;
      fiber.return = null;
      fiber.dependencies = null;
      fiber.memoizedProps = null;
      fiber.memoizedState = null;
      fiber.pendingProps = null;
      fiber.stateNode = null;
      fiber.updateQueue = null;
    }
    var hostParent = null;
    var hostParentIsContainer = false;
    function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
      for (parent = parent.child; null !== parent; )
        commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
    }
    function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
      if (injectedHook && "function" === typeof injectedHook.onCommitFiberUnmount)
        try {
          injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
        } catch (err) {
        }
      switch (deletedFiber.tag) {
        case 26:
          offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && (deletedFiber = deletedFiber.stateNode, deletedFiber.parentNode.removeChild(deletedFiber));
          break;
        case 27:
          offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
          var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
          isSingletonScope(deletedFiber.type) && (hostParent = deletedFiber.stateNode, hostParentIsContainer = false);
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          releaseSingletonInstance(deletedFiber.stateNode);
          hostParent = prevHostParent;
          hostParentIsContainer = prevHostParentIsContainer;
          break;
        case 5:
          offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
        case 6:
          prevHostParent = hostParent;
          prevHostParentIsContainer = hostParentIsContainer;
          hostParent = null;
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          hostParent = prevHostParent;
          hostParentIsContainer = prevHostParentIsContainer;
          if (null !== hostParent)
            if (hostParentIsContainer)
              try {
                (9 === hostParent.nodeType ? hostParent.body : "HTML" === hostParent.nodeName ? hostParent.ownerDocument.body : hostParent).removeChild(deletedFiber.stateNode);
              } catch (error) {
                captureCommitPhaseError(
                  deletedFiber,
                  nearestMountedAncestor,
                  error
                );
              }
            else
              try {
                hostParent.removeChild(deletedFiber.stateNode);
              } catch (error) {
                captureCommitPhaseError(
                  deletedFiber,
                  nearestMountedAncestor,
                  error
                );
              }
          break;
        case 18:
          null !== hostParent && (hostParentIsContainer ? (finishedRoot = hostParent, clearHydrationBoundary(
            9 === finishedRoot.nodeType ? finishedRoot.body : "HTML" === finishedRoot.nodeName ? finishedRoot.ownerDocument.body : finishedRoot,
            deletedFiber.stateNode
          ), retryIfBlockedOn(finishedRoot)) : clearHydrationBoundary(hostParent, deletedFiber.stateNode));
          break;
        case 4:
          prevHostParent = hostParent;
          prevHostParentIsContainer = hostParentIsContainer;
          hostParent = deletedFiber.stateNode.containerInfo;
          hostParentIsContainer = true;
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          hostParent = prevHostParent;
          hostParentIsContainer = prevHostParentIsContainer;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
          offscreenSubtreeWasHidden || commitHookEffectListUnmount(4, deletedFiber, nearestMountedAncestor);
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          break;
        case 1:
          offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, "function" === typeof prevHostParent.componentWillUnmount && safelyCallComponentWillUnmount(
            deletedFiber,
            nearestMountedAncestor,
            prevHostParent
          ));
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          break;
        case 21:
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          break;
        case 22:
          offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || null !== deletedFiber.memoizedState;
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
          offscreenSubtreeWasHidden = prevHostParent;
          break;
        default:
          recursivelyTraverseDeletionEffects(
            finishedRoot,
            nearestMountedAncestor,
            deletedFiber
          );
      }
    }
    function commitActivityHydrationCallbacks(finishedRoot, finishedWork) {
      if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot))) {
        finishedRoot = finishedRoot.dehydrated;
        try {
          retryIfBlockedOn(finishedRoot);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
    }
    function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
      if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot))))
        try {
          retryIfBlockedOn(finishedRoot);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
    }
    function getRetryCache(finishedWork) {
      switch (finishedWork.tag) {
        case 31:
        case 13:
        case 19:
          var retryCache = finishedWork.stateNode;
          null === retryCache && (retryCache = finishedWork.stateNode = new PossiblyWeakSet());
          return retryCache;
        case 22:
          return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, null === retryCache && (retryCache = finishedWork._retryCache = new PossiblyWeakSet()), retryCache;
        default:
          throw Error(formatProdErrorMessage(435, finishedWork.tag));
      }
    }
    function attachSuspenseRetryListeners(finishedWork, wakeables) {
      var retryCache = getRetryCache(finishedWork);
      wakeables.forEach(function(wakeable) {
        if (!retryCache.has(wakeable)) {
          retryCache.add(wakeable);
          var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
          wakeable.then(retry, retry);
        }
      });
    }
    function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber) {
      var deletions = parentFiber.deletions;
      if (null !== deletions)
        for (var i = 0; i < deletions.length; i++) {
          var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, parent = returnFiber;
          a: for (; null !== parent; ) {
            switch (parent.tag) {
              case 27:
                if (isSingletonScope(parent.type)) {
                  hostParent = parent.stateNode;
                  hostParentIsContainer = false;
                  break a;
                }
                break;
              case 5:
                hostParent = parent.stateNode;
                hostParentIsContainer = false;
                break a;
              case 3:
              case 4:
                hostParent = parent.stateNode.containerInfo;
                hostParentIsContainer = true;
                break a;
            }
            parent = parent.return;
          }
          if (null === hostParent) throw Error(formatProdErrorMessage(160));
          commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
          hostParent = null;
          hostParentIsContainer = false;
          root2 = childToDelete.alternate;
          null !== root2 && (root2.return = null);
          childToDelete.return = null;
        }
      if (parentFiber.subtreeFlags & 13886)
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          commitMutationEffectsOnFiber(parentFiber, root$jscomp$0), parentFiber = parentFiber.sibling;
    }
    var currentHoistableRoot = null;
    function commitMutationEffectsOnFiber(finishedWork, root2) {
      var current2 = finishedWork.alternate, flags = finishedWork.flags;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookEffectListUnmount(5, finishedWork, finishedWork.return));
          break;
        case 1:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 512 && (offscreenSubtreeWasHidden || null === current2 || safelyDetachRef(current2, current2.return));
          flags & 64 && offscreenSubtreeIsHidden && (finishedWork = finishedWork.updateQueue, null !== finishedWork && (flags = finishedWork.callbacks, null !== flags && (current2 = finishedWork.shared.hiddenCallbacks, finishedWork.shared.hiddenCallbacks = null === current2 ? flags : current2.concat(flags))));
          break;
        case 26:
          var hoistableRoot = currentHoistableRoot;
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 512 && (offscreenSubtreeWasHidden || null === current2 || safelyDetachRef(current2, current2.return));
          if (flags & 4) {
            var currentResource = null !== current2 ? current2.memoizedState : null;
            flags = finishedWork.memoizedState;
            if (null === current2)
              if (null === flags)
                if (null === finishedWork.stateNode) {
                  a: {
                    flags = finishedWork.type;
                    current2 = finishedWork.memoizedProps;
                    hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
                    b: switch (flags) {
                      case "title":
                        currentResource = hoistableRoot.getElementsByTagName("title")[0];
                        if (!currentResource || currentResource[internalHoistableMarker] || currentResource[internalInstanceKey] || "http://www.w3.org/2000/svg" === currentResource.namespaceURI || currentResource.hasAttribute("itemprop"))
                          currentResource = hoistableRoot.createElement(flags), hoistableRoot.head.insertBefore(
                            currentResource,
                            hoistableRoot.querySelector("head > title")
                          );
                        setInitialProperties(currentResource, flags, current2);
                        currentResource[internalInstanceKey] = finishedWork;
                        markNodeAsHoistable(currentResource);
                        flags = currentResource;
                        break a;
                      case "link":
                        var maybeNodes = getHydratableHoistableCache(
                          "link",
                          "href",
                          hoistableRoot
                        ).get(flags + (current2.href || ""));
                        if (maybeNodes) {
                          for (var i = 0; i < maybeNodes.length; i++)
                            if (currentResource = maybeNodes[i], currentResource.getAttribute("href") === (null == current2.href || "" === current2.href ? null : current2.href) && currentResource.getAttribute("rel") === (null == current2.rel ? null : current2.rel) && currentResource.getAttribute("title") === (null == current2.title ? null : current2.title) && currentResource.getAttribute("crossorigin") === (null == current2.crossOrigin ? null : current2.crossOrigin)) {
                              maybeNodes.splice(i, 1);
                              break b;
                            }
                        }
                        currentResource = hoistableRoot.createElement(flags);
                        setInitialProperties(currentResource, flags, current2);
                        hoistableRoot.head.appendChild(currentResource);
                        break;
                      case "meta":
                        if (maybeNodes = getHydratableHoistableCache(
                          "meta",
                          "content",
                          hoistableRoot
                        ).get(flags + (current2.content || ""))) {
                          for (i = 0; i < maybeNodes.length; i++)
                            if (currentResource = maybeNodes[i], currentResource.getAttribute("content") === (null == current2.content ? null : "" + current2.content) && currentResource.getAttribute("name") === (null == current2.name ? null : current2.name) && currentResource.getAttribute("property") === (null == current2.property ? null : current2.property) && currentResource.getAttribute("http-equiv") === (null == current2.httpEquiv ? null : current2.httpEquiv) && currentResource.getAttribute("charset") === (null == current2.charSet ? null : current2.charSet)) {
                              maybeNodes.splice(i, 1);
                              break b;
                            }
                        }
                        currentResource = hoistableRoot.createElement(flags);
                        setInitialProperties(currentResource, flags, current2);
                        hoistableRoot.head.appendChild(currentResource);
                        break;
                      default:
                        throw Error(formatProdErrorMessage(468, flags));
                    }
                    currentResource[internalInstanceKey] = finishedWork;
                    markNodeAsHoistable(currentResource);
                    flags = currentResource;
                  }
                  finishedWork.stateNode = flags;
                } else
                  mountHoistable(
                    hoistableRoot,
                    finishedWork.type,
                    finishedWork.stateNode
                  );
              else
                finishedWork.stateNode = acquireResource(
                  hoistableRoot,
                  flags,
                  finishedWork.memoizedProps
                );
            else
              currentResource !== flags ? (null === currentResource ? null !== current2.stateNode && (current2 = current2.stateNode, current2.parentNode.removeChild(current2)) : currentResource.count--, null === flags ? mountHoistable(
                hoistableRoot,
                finishedWork.type,
                finishedWork.stateNode
              ) : acquireResource(
                hoistableRoot,
                flags,
                finishedWork.memoizedProps
              )) : null === flags && null !== finishedWork.stateNode && commitHostUpdate(
                finishedWork,
                finishedWork.memoizedProps,
                current2.memoizedProps
              );
          }
          break;
        case 27:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 512 && (offscreenSubtreeWasHidden || null === current2 || safelyDetachRef(current2, current2.return));
          null !== current2 && flags & 4 && commitHostUpdate(
            finishedWork,
            finishedWork.memoizedProps,
            current2.memoizedProps
          );
          break;
        case 5:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 512 && (offscreenSubtreeWasHidden || null === current2 || safelyDetachRef(current2, current2.return));
          if (finishedWork.flags & 32) {
            hoistableRoot = finishedWork.stateNode;
            try {
              setTextContent(hoistableRoot, "");
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          }
          flags & 4 && null != finishedWork.stateNode && (hoistableRoot = finishedWork.memoizedProps, commitHostUpdate(
            finishedWork,
            hoistableRoot,
            null !== current2 ? current2.memoizedProps : hoistableRoot
          ));
          flags & 1024 && (needsFormReset = true);
          break;
        case 6:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          if (flags & 4) {
            if (null === finishedWork.stateNode)
              throw Error(formatProdErrorMessage(162));
            flags = finishedWork.memoizedProps;
            current2 = finishedWork.stateNode;
            try {
              current2.nodeValue = flags;
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          }
          break;
        case 3:
          tagCaches = null;
          hoistableRoot = currentHoistableRoot;
          currentHoistableRoot = getHoistableRoot(root2.containerInfo);
          recursivelyTraverseMutationEffects(root2, finishedWork);
          currentHoistableRoot = hoistableRoot;
          commitReconciliationEffects(finishedWork);
          if (flags & 4 && null !== current2 && current2.memoizedState.isDehydrated)
            try {
              retryIfBlockedOn(root2.containerInfo);
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
          break;
        case 4:
          flags = currentHoistableRoot;
          currentHoistableRoot = getHoistableRoot(
            finishedWork.stateNode.containerInfo
          );
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          currentHoistableRoot = flags;
          break;
        case 12:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          break;
        case 31:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
          break;
        case 13:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          finishedWork.child.flags & 8192 && null !== finishedWork.memoizedState !== (null !== current2 && null !== current2.memoizedState) && (globalMostRecentFallbackTime = now());
          flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
          break;
        case 22:
          hoistableRoot = null !== finishedWork.memoizedState;
          var wasHidden = null !== current2 && null !== current2.memoizedState, prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
          offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || hoistableRoot;
          offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
          recursivelyTraverseMutationEffects(root2, finishedWork);
          offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
          offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
          commitReconciliationEffects(finishedWork);
          if (flags & 8192)
            a: for (root2 = finishedWork.stateNode, root2._visibility = hoistableRoot ? root2._visibility & -2 : root2._visibility | 1, hoistableRoot && (null === current2 || wasHidden || offscreenSubtreeIsHidden || offscreenSubtreeWasHidden || recursivelyTraverseDisappearLayoutEffects(finishedWork)), current2 = null, root2 = finishedWork; ; ) {
              if (5 === root2.tag || 26 === root2.tag) {
                if (null === current2) {
                  wasHidden = current2 = root2;
                  try {
                    if (currentResource = wasHidden.stateNode, hoistableRoot)
                      maybeNodes = currentResource.style, "function" === typeof maybeNodes.setProperty ? maybeNodes.setProperty("display", "none", "important") : maybeNodes.display = "none";
                    else {
                      i = wasHidden.stateNode;
                      var styleProp = wasHidden.memoizedProps.style, display = void 0 !== styleProp && null !== styleProp && styleProp.hasOwnProperty("display") ? styleProp.display : null;
                      i.style.display = null == display || "boolean" === typeof display ? "" : ("" + display).trim();
                    }
                  } catch (error) {
                    captureCommitPhaseError(wasHidden, wasHidden.return, error);
                  }
                }
              } else if (6 === root2.tag) {
                if (null === current2) {
                  wasHidden = root2;
                  try {
                    wasHidden.stateNode.nodeValue = hoistableRoot ? "" : wasHidden.memoizedProps;
                  } catch (error) {
                    captureCommitPhaseError(wasHidden, wasHidden.return, error);
                  }
                }
              } else if (18 === root2.tag) {
                if (null === current2) {
                  wasHidden = root2;
                  try {
                    var instance = wasHidden.stateNode;
                    hoistableRoot ? hideOrUnhideDehydratedBoundary(instance, true) : hideOrUnhideDehydratedBoundary(wasHidden.stateNode, false);
                  } catch (error) {
                    captureCommitPhaseError(wasHidden, wasHidden.return, error);
                  }
                }
              } else if ((22 !== root2.tag && 23 !== root2.tag || null === root2.memoizedState || root2 === finishedWork) && null !== root2.child) {
                root2.child.return = root2;
                root2 = root2.child;
                continue;
              }
              if (root2 === finishedWork) break a;
              for (; null === root2.sibling; ) {
                if (null === root2.return || root2.return === finishedWork) break a;
                current2 === root2 && (current2 = null);
                root2 = root2.return;
              }
              current2 === root2 && (current2 = null);
              root2.sibling.return = root2.return;
              root2 = root2.sibling;
            }
          flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (current2 = flags.retryQueue, null !== current2 && (flags.retryQueue = null, attachSuspenseRetryListeners(finishedWork, current2))));
          break;
        case 19:
          recursivelyTraverseMutationEffects(root2, finishedWork);
          commitReconciliationEffects(finishedWork);
          flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
          break;
        case 30:
          break;
        case 21:
          break;
        default:
          recursivelyTraverseMutationEffects(root2, finishedWork), commitReconciliationEffects(finishedWork);
      }
    }
    function commitReconciliationEffects(finishedWork) {
      var flags = finishedWork.flags;
      if (flags & 2) {
        try {
          for (var hostParentFiber, parentFiber = finishedWork.return; null !== parentFiber; ) {
            if (isHostParent(parentFiber)) {
              hostParentFiber = parentFiber;
              break;
            }
            parentFiber = parentFiber.return;
          }
          if (null == hostParentFiber) throw Error(formatProdErrorMessage(160));
          switch (hostParentFiber.tag) {
            case 27:
              var parent = hostParentFiber.stateNode, before = getHostSibling(finishedWork);
              insertOrAppendPlacementNode(finishedWork, before, parent);
              break;
            case 5:
              var parent$141 = hostParentFiber.stateNode;
              hostParentFiber.flags & 32 && (setTextContent(parent$141, ""), hostParentFiber.flags &= -33);
              var before$142 = getHostSibling(finishedWork);
              insertOrAppendPlacementNode(finishedWork, before$142, parent$141);
              break;
            case 3:
            case 4:
              var parent$143 = hostParentFiber.stateNode.containerInfo, before$144 = getHostSibling(finishedWork);
              insertOrAppendPlacementNodeIntoContainer(
                finishedWork,
                before$144,
                parent$143
              );
              break;
            default:
              throw Error(formatProdErrorMessage(161));
          }
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
        finishedWork.flags &= -3;
      }
      flags & 4096 && (finishedWork.flags &= -4097);
    }
    function recursivelyResetForms(parentFiber) {
      if (parentFiber.subtreeFlags & 1024)
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var fiber = parentFiber;
          recursivelyResetForms(fiber);
          5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
          parentFiber = parentFiber.sibling;
        }
    }
    function recursivelyTraverseLayoutEffects(root2, parentFiber) {
      if (parentFiber.subtreeFlags & 8772)
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
    }
    function recursivelyTraverseDisappearLayoutEffects(parentFiber) {
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        var finishedWork = parentFiber;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            commitHookEffectListUnmount(4, finishedWork, finishedWork.return);
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
            break;
          case 1:
            safelyDetachRef(finishedWork, finishedWork.return);
            var instance = finishedWork.stateNode;
            "function" === typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(
              finishedWork,
              finishedWork.return,
              instance
            );
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
            break;
          case 27:
            releaseSingletonInstance(finishedWork.stateNode);
          case 26:
          case 5:
            safelyDetachRef(finishedWork, finishedWork.return);
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
            break;
          case 22:
            null === finishedWork.memoizedState && recursivelyTraverseDisappearLayoutEffects(finishedWork);
            break;
          case 30:
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
            break;
          default:
            recursivelyTraverseDisappearLayoutEffects(finishedWork);
        }
        parentFiber = parentFiber.sibling;
      }
    }
    function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, includeWorkInProgressEffects) {
      includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 8772);
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        var current2 = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            commitHookEffectListMount(4, finishedWork);
            break;
          case 1:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            current2 = finishedWork;
            finishedRoot = current2.stateNode;
            if ("function" === typeof finishedRoot.componentDidMount)
              try {
                finishedRoot.componentDidMount();
              } catch (error) {
                captureCommitPhaseError(current2, current2.return, error);
              }
            current2 = finishedWork;
            finishedRoot = current2.updateQueue;
            if (null !== finishedRoot) {
              var instance = current2.stateNode;
              try {
                var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
                if (null !== hiddenCallbacks)
                  for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0; finishedRoot < hiddenCallbacks.length; finishedRoot++)
                    callCallback(hiddenCallbacks[finishedRoot], instance);
              } catch (error) {
                captureCommitPhaseError(current2, current2.return, error);
              }
            }
            includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
            safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 27:
            commitHostSingletonAcquisition(finishedWork);
          case 26:
          case 5:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            includeWorkInProgressEffects && null === current2 && flags & 4 && commitHostMount(finishedWork);
            safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 12:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            break;
          case 31:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            includeWorkInProgressEffects && flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
            break;
          case 13:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
            break;
          case 22:
            null === finishedWork.memoizedState && recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
            safelyAttachRef(finishedWork, finishedWork.return);
            break;
          case 30:
            break;
          default:
            recursivelyTraverseReappearLayoutEffects(
              finishedRoot,
              finishedWork,
              includeWorkInProgressEffects
            );
        }
        parentFiber = parentFiber.sibling;
      }
    }
    function commitOffscreenPassiveMountEffects(current2, finishedWork) {
      var previousCache = null;
      null !== current2 && null !== current2.memoizedState && null !== current2.memoizedState.cachePool && (previousCache = current2.memoizedState.cachePool.pool);
      current2 = null;
      null !== finishedWork.memoizedState && null !== finishedWork.memoizedState.cachePool && (current2 = finishedWork.memoizedState.cachePool.pool);
      current2 !== previousCache && (null != current2 && current2.refCount++, null != previousCache && releaseCache(previousCache));
    }
    function commitCachePassiveMountEffect(current2, finishedWork) {
      current2 = null;
      null !== finishedWork.alternate && (current2 = finishedWork.alternate.memoizedState.cache);
      finishedWork = finishedWork.memoizedState.cache;
      finishedWork !== current2 && (finishedWork.refCount++, null != current2 && releaseCache(current2));
    }
    function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions) {
      if (parentFiber.subtreeFlags & 10256)
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          commitPassiveMountOnFiber(
            root2,
            parentFiber,
            committedLanes,
            committedTransitions
          ), parentFiber = parentFiber.sibling;
    }
    function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
      var flags = finishedWork.flags;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 15:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          flags & 2048 && commitHookEffectListMount(9, finishedWork);
          break;
        case 1:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          break;
        case 3:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          flags & 2048 && (finishedRoot = null, null !== finishedWork.alternate && (finishedRoot = finishedWork.alternate.memoizedState.cache), finishedWork = finishedWork.memoizedState.cache, finishedWork !== finishedRoot && (finishedWork.refCount++, null != finishedRoot && releaseCache(finishedRoot)));
          break;
        case 12:
          if (flags & 2048) {
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
            finishedRoot = finishedWork.stateNode;
            try {
              var _finishedWork$memoize2 = finishedWork.memoizedProps, id = _finishedWork$memoize2.id, onPostCommit = _finishedWork$memoize2.onPostCommit;
              "function" === typeof onPostCommit && onPostCommit(
                id,
                null === finishedWork.alternate ? "mount" : "update",
                finishedRoot.passiveEffectDuration,
                -0
              );
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          } else
            recursivelyTraversePassiveMountEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions
            );
          break;
        case 31:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          break;
        case 13:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          break;
        case 23:
          break;
        case 22:
          _finishedWork$memoize2 = finishedWork.stateNode;
          id = finishedWork.alternate;
          null !== finishedWork.memoizedState ? _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          ) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork) : _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          ) : (_finishedWork$memoize2._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            0 !== (finishedWork.subtreeFlags & 10256) || false
          ));
          flags & 2048 && commitOffscreenPassiveMountEffects(id, finishedWork);
          break;
        case 24:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
          break;
        default:
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
      }
    }
    function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects) {
      includeWorkInProgressEffects = includeWorkInProgressEffects && (0 !== (parentFiber.subtreeFlags & 10256) || false);
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 0:
          case 11:
          case 15:
            recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              includeWorkInProgressEffects
            );
            commitHookEffectListMount(8, finishedWork);
            break;
          case 23:
            break;
          case 22:
            var instance = finishedWork.stateNode;
            null !== finishedWork.memoizedState ? instance._visibility & 2 ? recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              includeWorkInProgressEffects
            ) : recursivelyTraverseAtomicPassiveEffects(
              finishedRoot,
              finishedWork
            ) : (instance._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              includeWorkInProgressEffects
            ));
            includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(
              finishedWork.alternate,
              finishedWork
            );
            break;
          case 24:
            recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              includeWorkInProgressEffects
            );
            includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
            break;
          default:
            recursivelyTraverseReconnectPassiveEffects(
              finishedRoot,
              finishedWork,
              committedLanes,
              committedTransitions,
              includeWorkInProgressEffects
            );
        }
        parentFiber = parentFiber.sibling;
      }
    }
    function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber) {
      if (parentFiber.subtreeFlags & 10256)
        for (parentFiber = parentFiber.child; null !== parentFiber; ) {
          var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
          switch (finishedWork.tag) {
            case 22:
              recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
              flags & 2048 && commitOffscreenPassiveMountEffects(
                finishedWork.alternate,
                finishedWork
              );
              break;
            case 24:
              recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
              flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
              break;
            default:
              recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
          }
          parentFiber = parentFiber.sibling;
        }
    }
    var suspenseyCommitFlag = 8192;
    function recursivelyAccumulateSuspenseyCommit(parentFiber, committedLanes, suspendedState) {
      if (parentFiber.subtreeFlags & suspenseyCommitFlag)
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          accumulateSuspenseyCommitOnFiber(
            parentFiber,
            committedLanes,
            suspendedState
          ), parentFiber = parentFiber.sibling;
    }
    function accumulateSuspenseyCommitOnFiber(fiber, committedLanes, suspendedState) {
      switch (fiber.tag) {
        case 26:
          recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          );
          fiber.flags & suspenseyCommitFlag && null !== fiber.memoizedState && suspendResource(
            suspendedState,
            currentHoistableRoot,
            fiber.memoizedState,
            fiber.memoizedProps
          );
          break;
        case 5:
          recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          );
          break;
        case 3:
        case 4:
          var previousHoistableRoot = currentHoistableRoot;
          currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
          recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          );
          currentHoistableRoot = previousHoistableRoot;
          break;
        case 22:
          null === fiber.memoizedState && (previousHoistableRoot = fiber.alternate, null !== previousHoistableRoot && null !== previousHoistableRoot.memoizedState ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          ), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          ));
          break;
        default:
          recursivelyAccumulateSuspenseyCommit(
            fiber,
            committedLanes,
            suspendedState
          );
      }
    }
    function detachAlternateSiblings(parentFiber) {
      var previousFiber = parentFiber.alternate;
      if (null !== previousFiber && (parentFiber = previousFiber.child, null !== parentFiber)) {
        previousFiber.child = null;
        do
          previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
        while (null !== parentFiber);
      }
    }
    function recursivelyTraversePassiveUnmountEffects(parentFiber) {
      var deletions = parentFiber.deletions;
      if (0 !== (parentFiber.flags & 16)) {
        if (null !== deletions)
          for (var i = 0; i < deletions.length; i++) {
            var childToDelete = deletions[i];
            nextEffect = childToDelete;
            commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
              childToDelete,
              parentFiber
            );
          }
        detachAlternateSiblings(parentFiber);
      }
      if (parentFiber.subtreeFlags & 10256)
        for (parentFiber = parentFiber.child; null !== parentFiber; )
          commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
    }
    function commitPassiveUnmountOnFiber(finishedWork) {
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 15:
          recursivelyTraversePassiveUnmountEffects(finishedWork);
          finishedWork.flags & 2048 && commitHookEffectListUnmount(9, finishedWork, finishedWork.return);
          break;
        case 3:
          recursivelyTraversePassiveUnmountEffects(finishedWork);
          break;
        case 12:
          recursivelyTraversePassiveUnmountEffects(finishedWork);
          break;
        case 22:
          var instance = finishedWork.stateNode;
          null !== finishedWork.memoizedState && instance._visibility & 2 && (null === finishedWork.return || 13 !== finishedWork.return.tag) ? (instance._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(finishedWork)) : recursivelyTraversePassiveUnmountEffects(finishedWork);
          break;
        default:
          recursivelyTraversePassiveUnmountEffects(finishedWork);
      }
    }
    function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
      var deletions = parentFiber.deletions;
      if (0 !== (parentFiber.flags & 16)) {
        if (null !== deletions)
          for (var i = 0; i < deletions.length; i++) {
            var childToDelete = deletions[i];
            nextEffect = childToDelete;
            commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
              childToDelete,
              parentFiber
            );
          }
        detachAlternateSiblings(parentFiber);
      }
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        deletions = parentFiber;
        switch (deletions.tag) {
          case 0:
          case 11:
          case 15:
            commitHookEffectListUnmount(8, deletions, deletions.return);
            recursivelyTraverseDisconnectPassiveEffects(deletions);
            break;
          case 22:
            i = deletions.stateNode;
            i._visibility & 2 && (i._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(deletions));
            break;
          default:
            recursivelyTraverseDisconnectPassiveEffects(deletions);
        }
        parentFiber = parentFiber.sibling;
      }
    }
    function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
      for (; null !== nextEffect; ) {
        var fiber = nextEffect;
        switch (fiber.tag) {
          case 0:
          case 11:
          case 15:
            commitHookEffectListUnmount(8, fiber, nearestMountedAncestor);
            break;
          case 23:
          case 22:
            if (null !== fiber.memoizedState && null !== fiber.memoizedState.cachePool) {
              var cache = fiber.memoizedState.cachePool.pool;
              null != cache && cache.refCount++;
            }
            break;
          case 24:
            releaseCache(fiber.memoizedState.cache);
        }
        cache = fiber.child;
        if (null !== cache) cache.return = fiber, nextEffect = cache;
        else
          a: for (fiber = deletedSubtreeRoot; null !== nextEffect; ) {
            cache = nextEffect;
            var sibling = cache.sibling, returnFiber = cache.return;
            detachFiberAfterEffects(cache);
            if (cache === fiber) {
              nextEffect = null;
              break a;
            }
            if (null !== sibling) {
              sibling.return = returnFiber;
              nextEffect = sibling;
              break a;
            }
            nextEffect = returnFiber;
          }
      }
    }
    var DefaultAsyncDispatcher = {
      getCacheForType: function(resourceType) {
        var cache = readContext(CacheContext), cacheForType = cache.data.get(resourceType);
        void 0 === cacheForType && (cacheForType = resourceType(), cache.data.set(resourceType, cacheForType));
        return cacheForType;
      },
      cacheSignal: function() {
        return readContext(CacheContext).controller.signal;
      }
    };
    var PossiblyWeakMap = "function" === typeof WeakMap ? WeakMap : Map;
    var executionContext = 0;
    var workInProgressRoot = null;
    var workInProgress = null;
    var workInProgressRootRenderLanes = 0;
    var workInProgressSuspendedReason = 0;
    var workInProgressThrownValue = null;
    var workInProgressRootDidSkipSuspendedSiblings = false;
    var workInProgressRootIsPrerendering = false;
    var workInProgressRootDidAttachPingListener = false;
    var entangledRenderLanes = 0;
    var workInProgressRootExitStatus = 0;
    var workInProgressRootSkippedLanes = 0;
    var workInProgressRootInterleavedUpdatedLanes = 0;
    var workInProgressRootPingedLanes = 0;
    var workInProgressDeferredLane = 0;
    var workInProgressSuspendedRetryLanes = 0;
    var workInProgressRootConcurrentErrors = null;
    var workInProgressRootRecoverableErrors = null;
    var workInProgressRootDidIncludeRecursiveRenderUpdate = false;
    var globalMostRecentFallbackTime = 0;
    var globalMostRecentTransitionTime = 0;
    var workInProgressRootRenderTargetTime = Infinity;
    var workInProgressTransitions = null;
    var legacyErrorBoundariesThatAlreadyFailed = null;
    var pendingEffectsStatus = 0;
    var pendingEffectsRoot = null;
    var pendingFinishedWork = null;
    var pendingEffectsLanes = 0;
    var pendingEffectsRemainingLanes = 0;
    var pendingPassiveTransitions = null;
    var pendingRecoverableErrors = null;
    var nestedUpdateCount = 0;
    var rootWithNestedUpdates = null;
    function requestUpdateLane() {
      return 0 !== (executionContext & 2) && 0 !== workInProgressRootRenderLanes ? workInProgressRootRenderLanes & -workInProgressRootRenderLanes : null !== ReactSharedInternals.T ? requestTransitionLane() : resolveUpdatePriority();
    }
    function requestDeferredLane() {
      if (0 === workInProgressDeferredLane)
        if (0 === (workInProgressRootRenderLanes & 536870912) || isHydrating) {
          var lane = nextTransitionDeferredLane;
          nextTransitionDeferredLane <<= 1;
          0 === (nextTransitionDeferredLane & 3932160) && (nextTransitionDeferredLane = 262144);
          workInProgressDeferredLane = lane;
        } else workInProgressDeferredLane = 536870912;
      lane = suspenseHandlerStackCursor.current;
      null !== lane && (lane.flags |= 32);
      return workInProgressDeferredLane;
    }
    function scheduleUpdateOnFiber(root2, fiber, lane) {
      if (root2 === workInProgressRoot && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
        prepareFreshStack(root2, 0), markRootSuspended(
          root2,
          workInProgressRootRenderLanes,
          workInProgressDeferredLane,
          false
        );
      markRootUpdated$1(root2, lane);
      if (0 === (executionContext & 2) || root2 !== workInProgressRoot)
        root2 === workInProgressRoot && (0 === (executionContext & 2) && (workInProgressRootInterleavedUpdatedLanes |= lane), 4 === workInProgressRootExitStatus && markRootSuspended(
          root2,
          workInProgressRootRenderLanes,
          workInProgressDeferredLane,
          false
        )), ensureRootIsScheduled(root2);
    }
    function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
      if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
      var shouldTimeSlice = !forceSync && 0 === (lanes & 127) && 0 === (lanes & root$jscomp$0.expiredLanes) || checkIfRootIsPrerendering(root$jscomp$0, lanes), exitStatus = shouldTimeSlice ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = shouldTimeSlice;
      do {
        if (0 === exitStatus) {
          workInProgressRootIsPrerendering && !shouldTimeSlice && markRootSuspended(root$jscomp$0, lanes, 0, false);
          break;
        } else {
          forceSync = root$jscomp$0.current.alternate;
          if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
            exitStatus = renderRootSync(root$jscomp$0, lanes, false);
            renderWasConcurrent = false;
            continue;
          }
          if (2 === exitStatus) {
            renderWasConcurrent = lanes;
            if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
              var JSCompiler_inline_result = 0;
            else
              JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = 0 !== JSCompiler_inline_result ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
            if (0 !== JSCompiler_inline_result) {
              lanes = JSCompiler_inline_result;
              a: {
                var root2 = root$jscomp$0;
                exitStatus = workInProgressRootConcurrentErrors;
                var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
                wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
                JSCompiler_inline_result = renderRootSync(
                  root2,
                  JSCompiler_inline_result,
                  false
                );
                if (2 !== JSCompiler_inline_result) {
                  if (workInProgressRootDidAttachPingListener && !wasRootDehydrated) {
                    root2.errorRecoveryDisabledLanes |= renderWasConcurrent;
                    workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent;
                    exitStatus = 4;
                    break a;
                  }
                  renderWasConcurrent = workInProgressRootRecoverableErrors;
                  workInProgressRootRecoverableErrors = exitStatus;
                  null !== renderWasConcurrent && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = renderWasConcurrent : workInProgressRootRecoverableErrors.push.apply(
                    workInProgressRootRecoverableErrors,
                    renderWasConcurrent
                  ));
                }
                exitStatus = JSCompiler_inline_result;
              }
              renderWasConcurrent = false;
              if (2 !== exitStatus) continue;
            }
          }
          if (1 === exitStatus) {
            prepareFreshStack(root$jscomp$0, 0);
            markRootSuspended(root$jscomp$0, lanes, 0, true);
            break;
          }
          a: {
            shouldTimeSlice = root$jscomp$0;
            renderWasConcurrent = exitStatus;
            switch (renderWasConcurrent) {
              case 0:
              case 1:
                throw Error(formatProdErrorMessage(345));
              case 4:
                if ((lanes & 4194048) !== lanes) break;
              case 6:
                markRootSuspended(
                  shouldTimeSlice,
                  lanes,
                  workInProgressDeferredLane,
                  !workInProgressRootDidSkipSuspendedSiblings
                );
                break a;
              case 2:
                workInProgressRootRecoverableErrors = null;
                break;
              case 3:
              case 5:
                break;
              default:
                throw Error(formatProdErrorMessage(329));
            }
            if ((lanes & 62914560) === lanes && (exitStatus = globalMostRecentFallbackTime + 300 - now(), 10 < exitStatus)) {
              markRootSuspended(
                shouldTimeSlice,
                lanes,
                workInProgressDeferredLane,
                !workInProgressRootDidSkipSuspendedSiblings
              );
              if (0 !== getNextLanes(shouldTimeSlice, 0, true)) break a;
              pendingEffectsLanes = lanes;
              shouldTimeSlice.timeoutHandle = scheduleTimeout(
                commitRootWhenReady.bind(
                  null,
                  shouldTimeSlice,
                  forceSync,
                  workInProgressRootRecoverableErrors,
                  workInProgressTransitions,
                  workInProgressRootDidIncludeRecursiveRenderUpdate,
                  lanes,
                  workInProgressDeferredLane,
                  workInProgressRootInterleavedUpdatedLanes,
                  workInProgressSuspendedRetryLanes,
                  workInProgressRootDidSkipSuspendedSiblings,
                  renderWasConcurrent,
                  "Throttled",
                  -0,
                  0
                ),
                exitStatus
              );
              break a;
            }
            commitRootWhenReady(
              shouldTimeSlice,
              forceSync,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions,
              workInProgressRootDidIncludeRecursiveRenderUpdate,
              lanes,
              workInProgressDeferredLane,
              workInProgressRootInterleavedUpdatedLanes,
              workInProgressSuspendedRetryLanes,
              workInProgressRootDidSkipSuspendedSiblings,
              renderWasConcurrent,
              null,
              -0,
              0
            );
          }
        }
        break;
      } while (1);
      ensureRootIsScheduled(root$jscomp$0);
    }
    function commitRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
      root2.timeoutHandle = -1;
      suspendedCommitReason = finishedWork.subtreeFlags;
      if (suspendedCommitReason & 8192 || 16785408 === (suspendedCommitReason & 16785408)) {
        suspendedCommitReason = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: true,
          waitingForViewTransition: false,
          unsuspend: noop$1
        };
        accumulateSuspenseyCommitOnFiber(
          finishedWork,
          lanes,
          suspendedCommitReason
        );
        var timeoutOffset = (lanes & 62914560) === lanes ? globalMostRecentFallbackTime - now() : (lanes & 4194048) === lanes ? globalMostRecentTransitionTime - now() : 0;
        timeoutOffset = waitForCommitToBeReady(
          suspendedCommitReason,
          timeoutOffset
        );
        if (null !== timeoutOffset) {
          pendingEffectsLanes = lanes;
          root2.cancelPendingCommit = timeoutOffset(
            commitRoot.bind(
              null,
              root2,
              finishedWork,
              lanes,
              recoverableErrors,
              transitions,
              didIncludeRenderPhaseUpdate,
              spawnedLane,
              updatedLanes,
              suspendedRetryLanes,
              exitStatus,
              suspendedCommitReason,
              null,
              completedRenderStartTime,
              completedRenderEndTime
            )
          );
          markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
          return;
        }
      }
      commitRoot(
        root2,
        finishedWork,
        lanes,
        recoverableErrors,
        transitions,
        didIncludeRenderPhaseUpdate,
        spawnedLane,
        updatedLanes,
        suspendedRetryLanes
      );
    }
    function isRenderConsistentWithExternalStores(finishedWork) {
      for (var node = finishedWork; ; ) {
        var tag = node.tag;
        if ((0 === tag || 11 === tag || 15 === tag) && node.flags & 16384 && (tag = node.updateQueue, null !== tag && (tag = tag.stores, null !== tag)))
          for (var i = 0; i < tag.length; i++) {
            var check = tag[i], getSnapshot = check.getSnapshot;
            check = check.value;
            try {
              if (!objectIs(getSnapshot(), check)) return false;
            } catch (error) {
              return false;
            }
          }
        tag = node.child;
        if (node.subtreeFlags & 16384 && null !== tag)
          tag.return = node, node = tag;
        else {
          if (node === finishedWork) break;
          for (; null === node.sibling; ) {
            if (null === node.return || node.return === finishedWork) return true;
            node = node.return;
          }
          node.sibling.return = node.return;
          node = node.sibling;
        }
      }
      return true;
    }
    function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
      suspendedLanes &= ~workInProgressRootPingedLanes;
      suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
      root2.suspendedLanes |= suspendedLanes;
      root2.pingedLanes &= ~suspendedLanes;
      didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
      didAttemptEntireTree = root2.expirationTimes;
      for (var lanes = suspendedLanes; 0 < lanes; ) {
        var index$6 = 31 - clz32(lanes), lane = 1 << index$6;
        didAttemptEntireTree[index$6] = -1;
        lanes &= ~lane;
      }
      0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
    }
    function flushSyncWork$1() {
      return 0 === (executionContext & 6) ? (flushSyncWorkAcrossRoots_impl(0, false), false) : true;
    }
    function resetWorkInProgressStack() {
      if (null !== workInProgress) {
        if (0 === workInProgressSuspendedReason)
          var interruptedWork = workInProgress.return;
        else
          interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber$1 = null, resetHooksOnUnwind(interruptedWork), thenableState$1 = null, thenableIndexCounter$1 = 0, interruptedWork = workInProgress;
        for (; null !== interruptedWork; )
          unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
        workInProgress = null;
      }
    }
    function prepareFreshStack(root2, lanes) {
      var timeoutHandle = root2.timeoutHandle;
      -1 !== timeoutHandle && (root2.timeoutHandle = -1, cancelTimeout(timeoutHandle));
      timeoutHandle = root2.cancelPendingCommit;
      null !== timeoutHandle && (root2.cancelPendingCommit = null, timeoutHandle());
      pendingEffectsLanes = 0;
      resetWorkInProgressStack();
      workInProgressRoot = root2;
      workInProgress = timeoutHandle = createWorkInProgress(root2.current, null);
      workInProgressRootRenderLanes = lanes;
      workInProgressSuspendedReason = 0;
      workInProgressThrownValue = null;
      workInProgressRootDidSkipSuspendedSiblings = false;
      workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
      workInProgressRootDidAttachPingListener = false;
      workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
      workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
      workInProgressRootDidIncludeRecursiveRenderUpdate = false;
      0 !== (lanes & 8) && (lanes |= lanes & 32);
      var allEntangledLanes = root2.entangledLanes;
      if (0 !== allEntangledLanes)
        for (root2 = root2.entanglements, allEntangledLanes &= lanes; 0 < allEntangledLanes; ) {
          var index$4 = 31 - clz32(allEntangledLanes), lane = 1 << index$4;
          lanes |= root2[index$4];
          allEntangledLanes &= ~lane;
        }
      entangledRenderLanes = lanes;
      finishQueueingConcurrentUpdates();
      return timeoutHandle;
    }
    function handleThrow(root2, thrownValue) {
      currentlyRenderingFiber = null;
      ReactSharedInternals.H = ContextOnlyDispatcher;
      thrownValue === SuspenseException || thrownValue === SuspenseActionException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : null !== thrownValue && "object" === typeof thrownValue && "function" === typeof thrownValue.then ? 6 : 1;
      workInProgressThrownValue = thrownValue;
      null === workInProgress && (workInProgressRootExitStatus = 1, logUncaughtError(
        root2,
        createCapturedValueAtFiber(thrownValue, root2.current)
      ));
    }
    function shouldRemainOnPreviousScreen() {
      var handler = suspenseHandlerStackCursor.current;
      return null === handler ? true : (workInProgressRootRenderLanes & 4194048) === workInProgressRootRenderLanes ? null === shellBoundary ? true : false : (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes || 0 !== (workInProgressRootRenderLanes & 536870912) ? handler === shellBoundary : false;
    }
    function pushDispatcher() {
      var prevDispatcher = ReactSharedInternals.H;
      ReactSharedInternals.H = ContextOnlyDispatcher;
      return null === prevDispatcher ? ContextOnlyDispatcher : prevDispatcher;
    }
    function pushAsyncDispatcher() {
      var prevAsyncDispatcher = ReactSharedInternals.A;
      ReactSharedInternals.A = DefaultAsyncDispatcher;
      return prevAsyncDispatcher;
    }
    function renderDidSuspendDelayIfPossible() {
      workInProgressRootExitStatus = 4;
      workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194048) !== workInProgressRootRenderLanes && null !== suspenseHandlerStackCursor.current || (workInProgressRootIsPrerendering = true);
      0 === (workInProgressRootSkippedLanes & 134217727) && 0 === (workInProgressRootInterleavedUpdatedLanes & 134217727) || null === workInProgressRoot || markRootSuspended(
        workInProgressRoot,
        workInProgressRootRenderLanes,
        workInProgressDeferredLane,
        false
      );
    }
    function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
      var prevExecutionContext = executionContext;
      executionContext |= 2;
      var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
      if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes)
        workInProgressTransitions = null, prepareFreshStack(root2, lanes);
      lanes = false;
      var exitStatus = workInProgressRootExitStatus;
      a: do
        try {
          if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
            var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
            switch (workInProgressSuspendedReason) {
              case 8:
                resetWorkInProgressStack();
                exitStatus = 6;
                break a;
              case 3:
              case 2:
              case 9:
              case 6:
                null === suspenseHandlerStackCursor.current && (lanes = true);
                var reason = workInProgressSuspendedReason;
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
                if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                  exitStatus = 0;
                  break a;
                }
                break;
              default:
                reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
            }
          }
          workLoopSync();
          exitStatus = workInProgressRootExitStatus;
          break;
        } catch (thrownValue$165) {
          handleThrow(root2, thrownValue$165);
        }
      while (1);
      lanes && root2.shellSuspendCounter++;
      lastContextDependency = currentlyRenderingFiber$1 = null;
      executionContext = prevExecutionContext;
      ReactSharedInternals.H = prevDispatcher;
      ReactSharedInternals.A = prevAsyncDispatcher;
      null === workInProgress && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
      return exitStatus;
    }
    function workLoopSync() {
      for (; null !== workInProgress; ) performUnitOfWork(workInProgress);
    }
    function renderRootConcurrent(root2, lanes) {
      var prevExecutionContext = executionContext;
      executionContext |= 2;
      var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
      workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes ? (workInProgressTransitions = null, workInProgressRootRenderTargetTime = now() + 500, prepareFreshStack(root2, lanes)) : workInProgressRootIsPrerendering = checkIfRootIsPrerendering(
        root2,
        lanes
      );
      a: do
        try {
          if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
            lanes = workInProgress;
            var thrownValue = workInProgressThrownValue;
            b: switch (workInProgressSuspendedReason) {
              case 1:
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, thrownValue, 1);
                break;
              case 2:
              case 9:
                if (isThenableResolved(thrownValue)) {
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  replaySuspendedUnitOfWork(lanes);
                  break;
                }
                lanes = function() {
                  2 !== workInProgressSuspendedReason && 9 !== workInProgressSuspendedReason || workInProgressRoot !== root2 || (workInProgressSuspendedReason = 7);
                  ensureRootIsScheduled(root2);
                };
                thrownValue.then(lanes, lanes);
                break a;
              case 3:
                workInProgressSuspendedReason = 7;
                break a;
              case 4:
                workInProgressSuspendedReason = 5;
                break a;
              case 7:
                isThenableResolved(thrownValue) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, thrownValue, 7));
                break;
              case 5:
                var resource = null;
                switch (workInProgress.tag) {
                  case 26:
                    resource = workInProgress.memoizedState;
                  case 5:
                  case 27:
                    var hostFiber = workInProgress;
                    if (resource ? preloadResource(resource) : hostFiber.stateNode.complete) {
                      workInProgressSuspendedReason = 0;
                      workInProgressThrownValue = null;
                      var sibling = hostFiber.sibling;
                      if (null !== sibling) workInProgress = sibling;
                      else {
                        var returnFiber = hostFiber.return;
                        null !== returnFiber ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                      }
                      break b;
                    }
                }
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, thrownValue, 5);
                break;
              case 6:
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, thrownValue, 6);
                break;
              case 8:
                resetWorkInProgressStack();
                workInProgressRootExitStatus = 6;
                break a;
              default:
                throw Error(formatProdErrorMessage(462));
            }
          }
          workLoopConcurrentByScheduler();
          break;
        } catch (thrownValue$167) {
          handleThrow(root2, thrownValue$167);
        }
      while (1);
      lastContextDependency = currentlyRenderingFiber$1 = null;
      ReactSharedInternals.H = prevDispatcher;
      ReactSharedInternals.A = prevAsyncDispatcher;
      executionContext = prevExecutionContext;
      if (null !== workInProgress) return 0;
      workInProgressRoot = null;
      workInProgressRootRenderLanes = 0;
      finishQueueingConcurrentUpdates();
      return workInProgressRootExitStatus;
    }
    function workLoopConcurrentByScheduler() {
      for (; null !== workInProgress && !shouldYield(); )
        performUnitOfWork(workInProgress);
    }
    function performUnitOfWork(unitOfWork) {
      var next = beginWork(unitOfWork.alternate, unitOfWork, entangledRenderLanes);
      unitOfWork.memoizedProps = unitOfWork.pendingProps;
      null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
    }
    function replaySuspendedUnitOfWork(unitOfWork) {
      var next = unitOfWork;
      var current2 = next.alternate;
      switch (next.tag) {
        case 15:
        case 0:
          next = replayFunctionComponent(
            current2,
            next,
            next.pendingProps,
            next.type,
            void 0,
            workInProgressRootRenderLanes
          );
          break;
        case 11:
          next = replayFunctionComponent(
            current2,
            next,
            next.pendingProps,
            next.type.render,
            next.ref,
            workInProgressRootRenderLanes
          );
          break;
        case 5:
          resetHooksOnUnwind(next);
        default:
          unwindInterruptedWork(current2, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), next = beginWork(current2, next, entangledRenderLanes);
      }
      unitOfWork.memoizedProps = unitOfWork.pendingProps;
      null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
    }
    function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
      lastContextDependency = currentlyRenderingFiber$1 = null;
      resetHooksOnUnwind(unitOfWork);
      thenableState$1 = null;
      thenableIndexCounter$1 = 0;
      var returnFiber = unitOfWork.return;
      try {
        if (throwException(
          root2,
          returnFiber,
          unitOfWork,
          thrownValue,
          workInProgressRootRenderLanes
        )) {
          workInProgressRootExitStatus = 1;
          logUncaughtError(
            root2,
            createCapturedValueAtFiber(thrownValue, root2.current)
          );
          workInProgress = null;
          return;
        }
      } catch (error) {
        if (null !== returnFiber) throw workInProgress = returnFiber, error;
        workInProgressRootExitStatus = 1;
        logUncaughtError(
          root2,
          createCapturedValueAtFiber(thrownValue, root2.current)
        );
        workInProgress = null;
        return;
      }
      if (unitOfWork.flags & 32768) {
        if (isHydrating || 1 === suspendedReason) root2 = true;
        else if (workInProgressRootIsPrerendering || 0 !== (workInProgressRootRenderLanes & 536870912))
          root2 = false;
        else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, 2 === suspendedReason || 9 === suspendedReason || 3 === suspendedReason || 6 === suspendedReason)
          suspendedReason = suspenseHandlerStackCursor.current, null !== suspendedReason && 13 === suspendedReason.tag && (suspendedReason.flags |= 16384);
        unwindUnitOfWork(unitOfWork, root2);
      } else completeUnitOfWork(unitOfWork);
    }
    function completeUnitOfWork(unitOfWork) {
      var completedWork = unitOfWork;
      do {
        if (0 !== (completedWork.flags & 32768)) {
          unwindUnitOfWork(
            completedWork,
            workInProgressRootDidSkipSuspendedSiblings
          );
          return;
        }
        unitOfWork = completedWork.return;
        var next = completeWork(
          completedWork.alternate,
          completedWork,
          entangledRenderLanes
        );
        if (null !== next) {
          workInProgress = next;
          return;
        }
        completedWork = completedWork.sibling;
        if (null !== completedWork) {
          workInProgress = completedWork;
          return;
        }
        workInProgress = completedWork = unitOfWork;
      } while (null !== completedWork);
      0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 5);
    }
    function unwindUnitOfWork(unitOfWork, skipSiblings) {
      do {
        var next = unwindWork(unitOfWork.alternate, unitOfWork);
        if (null !== next) {
          next.flags &= 32767;
          workInProgress = next;
          return;
        }
        next = unitOfWork.return;
        null !== next && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
        if (!skipSiblings && (unitOfWork = unitOfWork.sibling, null !== unitOfWork)) {
          workInProgress = unitOfWork;
          return;
        }
        workInProgress = unitOfWork = next;
      } while (null !== unitOfWork);
      workInProgressRootExitStatus = 6;
      workInProgress = null;
    }
    function commitRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes) {
      root2.cancelPendingCommit = null;
      do
        flushPendingEffects();
      while (0 !== pendingEffectsStatus);
      if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
      if (null !== finishedWork) {
        if (finishedWork === root2.current) throw Error(formatProdErrorMessage(177));
        didIncludeRenderPhaseUpdate = finishedWork.lanes | finishedWork.childLanes;
        didIncludeRenderPhaseUpdate |= concurrentlyUpdatedLanes;
        markRootFinished(
          root2,
          lanes,
          didIncludeRenderPhaseUpdate,
          spawnedLane,
          updatedLanes,
          suspendedRetryLanes
        );
        root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
        pendingFinishedWork = finishedWork;
        pendingEffectsRoot = root2;
        pendingEffectsLanes = lanes;
        pendingEffectsRemainingLanes = didIncludeRenderPhaseUpdate;
        pendingPassiveTransitions = transitions;
        pendingRecoverableErrors = recoverableErrors;
        0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? (root2.callbackNode = null, root2.callbackPriority = 0, scheduleCallback$1(NormalPriority$1, function() {
          flushPassiveEffects();
          return null;
        })) : (root2.callbackNode = null, root2.callbackPriority = 0);
        recoverableErrors = 0 !== (finishedWork.flags & 13878);
        if (0 !== (finishedWork.subtreeFlags & 13878) || recoverableErrors) {
          recoverableErrors = ReactSharedInternals.T;
          ReactSharedInternals.T = null;
          transitions = ReactDOMSharedInternals.p;
          ReactDOMSharedInternals.p = 2;
          spawnedLane = executionContext;
          executionContext |= 4;
          try {
            commitBeforeMutationEffects(root2, finishedWork, lanes);
          } finally {
            executionContext = spawnedLane, ReactDOMSharedInternals.p = transitions, ReactSharedInternals.T = recoverableErrors;
          }
        }
        pendingEffectsStatus = 1;
        flushMutationEffects();
        flushLayoutEffects();
        flushSpawnedWork();
      }
    }
    function flushMutationEffects() {
      if (1 === pendingEffectsStatus) {
        pendingEffectsStatus = 0;
        var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootMutationHasEffect = 0 !== (finishedWork.flags & 13878);
        if (0 !== (finishedWork.subtreeFlags & 13878) || rootMutationHasEffect) {
          rootMutationHasEffect = ReactSharedInternals.T;
          ReactSharedInternals.T = null;
          var previousPriority = ReactDOMSharedInternals.p;
          ReactDOMSharedInternals.p = 2;
          var prevExecutionContext = executionContext;
          executionContext |= 4;
          try {
            commitMutationEffectsOnFiber(finishedWork, root2);
            var priorSelectionInformation = selectionInformation, curFocusedElem = getActiveElementDeep(root2.containerInfo), priorFocusedElem = priorSelectionInformation.focusedElem, priorSelectionRange = priorSelectionInformation.selectionRange;
            if (curFocusedElem !== priorFocusedElem && priorFocusedElem && priorFocusedElem.ownerDocument && containsNode(
              priorFocusedElem.ownerDocument.documentElement,
              priorFocusedElem
            )) {
              if (null !== priorSelectionRange && hasSelectionCapabilities(priorFocusedElem)) {
                var start = priorSelectionRange.start, end = priorSelectionRange.end;
                void 0 === end && (end = start);
                if ("selectionStart" in priorFocusedElem)
                  priorFocusedElem.selectionStart = start, priorFocusedElem.selectionEnd = Math.min(
                    end,
                    priorFocusedElem.value.length
                  );
                else {
                  var doc = priorFocusedElem.ownerDocument || document, win = doc && doc.defaultView || window;
                  if (win.getSelection) {
                    var selection = win.getSelection(), length = priorFocusedElem.textContent.length, start$jscomp$0 = Math.min(priorSelectionRange.start, length), end$jscomp$0 = void 0 === priorSelectionRange.end ? start$jscomp$0 : Math.min(priorSelectionRange.end, length);
                    !selection.extend && start$jscomp$0 > end$jscomp$0 && (curFocusedElem = end$jscomp$0, end$jscomp$0 = start$jscomp$0, start$jscomp$0 = curFocusedElem);
                    var startMarker = getNodeForCharacterOffset(
                      priorFocusedElem,
                      start$jscomp$0
                    ), endMarker = getNodeForCharacterOffset(
                      priorFocusedElem,
                      end$jscomp$0
                    );
                    if (startMarker && endMarker && (1 !== selection.rangeCount || selection.anchorNode !== startMarker.node || selection.anchorOffset !== startMarker.offset || selection.focusNode !== endMarker.node || selection.focusOffset !== endMarker.offset)) {
                      var range = doc.createRange();
                      range.setStart(startMarker.node, startMarker.offset);
                      selection.removeAllRanges();
                      start$jscomp$0 > end$jscomp$0 ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), selection.addRange(range));
                    }
                  }
                }
              }
              doc = [];
              for (selection = priorFocusedElem; selection = selection.parentNode; )
                1 === selection.nodeType && doc.push({
                  element: selection,
                  left: selection.scrollLeft,
                  top: selection.scrollTop
                });
              "function" === typeof priorFocusedElem.focus && priorFocusedElem.focus();
              for (priorFocusedElem = 0; priorFocusedElem < doc.length; priorFocusedElem++) {
                var info = doc[priorFocusedElem];
                info.element.scrollLeft = info.left;
                info.element.scrollTop = info.top;
              }
            }
            _enabled = !!eventsEnabled;
            selectionInformation = eventsEnabled = null;
          } finally {
            executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootMutationHasEffect;
          }
        }
        root2.current = finishedWork;
        pendingEffectsStatus = 2;
      }
    }
    function flushLayoutEffects() {
      if (2 === pendingEffectsStatus) {
        pendingEffectsStatus = 0;
        var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootHasLayoutEffect = 0 !== (finishedWork.flags & 8772);
        if (0 !== (finishedWork.subtreeFlags & 8772) || rootHasLayoutEffect) {
          rootHasLayoutEffect = ReactSharedInternals.T;
          ReactSharedInternals.T = null;
          var previousPriority = ReactDOMSharedInternals.p;
          ReactDOMSharedInternals.p = 2;
          var prevExecutionContext = executionContext;
          executionContext |= 4;
          try {
            commitLayoutEffectOnFiber(root2, finishedWork.alternate, finishedWork);
          } finally {
            executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootHasLayoutEffect;
          }
        }
        pendingEffectsStatus = 3;
      }
    }
    function flushSpawnedWork() {
      if (4 === pendingEffectsStatus || 3 === pendingEffectsStatus) {
        pendingEffectsStatus = 0;
        requestPaint();
        var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, recoverableErrors = pendingRecoverableErrors;
        0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? pendingEffectsStatus = 5 : (pendingEffectsStatus = 0, pendingFinishedWork = pendingEffectsRoot = null, releaseRootPooledCache(root2, root2.pendingLanes));
        var remainingLanes = root2.pendingLanes;
        0 === remainingLanes && (legacyErrorBoundariesThatAlreadyFailed = null);
        lanesToEventPriority(lanes);
        finishedWork = finishedWork.stateNode;
        if (injectedHook && "function" === typeof injectedHook.onCommitFiberRoot)
          try {
            injectedHook.onCommitFiberRoot(
              rendererID,
              finishedWork,
              void 0,
              128 === (finishedWork.current.flags & 128)
            );
          } catch (err) {
          }
        if (null !== recoverableErrors) {
          finishedWork = ReactSharedInternals.T;
          remainingLanes = ReactDOMSharedInternals.p;
          ReactDOMSharedInternals.p = 2;
          ReactSharedInternals.T = null;
          try {
            for (var onRecoverableError = root2.onRecoverableError, i = 0; i < recoverableErrors.length; i++) {
              var recoverableError = recoverableErrors[i];
              onRecoverableError(recoverableError.value, {
                componentStack: recoverableError.stack
              });
            }
          } finally {
            ReactSharedInternals.T = finishedWork, ReactDOMSharedInternals.p = remainingLanes;
          }
        }
        0 !== (pendingEffectsLanes & 3) && flushPendingEffects();
        ensureRootIsScheduled(root2);
        remainingLanes = root2.pendingLanes;
        0 !== (lanes & 261930) && 0 !== (remainingLanes & 42) ? root2 === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = root2) : nestedUpdateCount = 0;
        flushSyncWorkAcrossRoots_impl(0, false);
      }
    }
    function releaseRootPooledCache(root2, remainingLanes) {
      0 === (root2.pooledCacheLanes &= remainingLanes) && (remainingLanes = root2.pooledCache, null != remainingLanes && (root2.pooledCache = null, releaseCache(remainingLanes)));
    }
    function flushPendingEffects() {
      flushMutationEffects();
      flushLayoutEffects();
      flushSpawnedWork();
      return flushPassiveEffects();
    }
    function flushPassiveEffects() {
      if (5 !== pendingEffectsStatus) return false;
      var root2 = pendingEffectsRoot, remainingLanes = pendingEffectsRemainingLanes;
      pendingEffectsRemainingLanes = 0;
      var renderPriority = lanesToEventPriority(pendingEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
      try {
        ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
        ReactSharedInternals.T = null;
        renderPriority = pendingPassiveTransitions;
        pendingPassiveTransitions = null;
        var root$jscomp$0 = pendingEffectsRoot, lanes = pendingEffectsLanes;
        pendingEffectsStatus = 0;
        pendingFinishedWork = pendingEffectsRoot = null;
        pendingEffectsLanes = 0;
        if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(331));
        var prevExecutionContext = executionContext;
        executionContext |= 4;
        commitPassiveUnmountOnFiber(root$jscomp$0.current);
        commitPassiveMountOnFiber(
          root$jscomp$0,
          root$jscomp$0.current,
          lanes,
          renderPriority
        );
        executionContext = prevExecutionContext;
        flushSyncWorkAcrossRoots_impl(0, false);
        if (injectedHook && "function" === typeof injectedHook.onPostCommitFiberRoot)
          try {
            injectedHook.onPostCommitFiberRoot(rendererID, root$jscomp$0);
          } catch (err) {
          }
        return true;
      } finally {
        ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root2, remainingLanes);
      }
    }
    function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
      sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
      sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
      rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
      null !== rootFiber && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
    }
    function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
      if (3 === sourceFiber.tag)
        captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
      else
        for (; null !== nearestMountedAncestor; ) {
          if (3 === nearestMountedAncestor.tag) {
            captureCommitPhaseErrorOnRoot(
              nearestMountedAncestor,
              sourceFiber,
              error
            );
            break;
          } else if (1 === nearestMountedAncestor.tag) {
            var instance = nearestMountedAncestor.stateNode;
            if ("function" === typeof nearestMountedAncestor.type.getDerivedStateFromError || "function" === typeof instance.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
              sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
              error = createClassErrorUpdate(2);
              instance = enqueueUpdate(nearestMountedAncestor, error, 2);
              null !== instance && (initializeClassErrorUpdate(
                error,
                instance,
                nearestMountedAncestor,
                sourceFiber
              ), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
              break;
            }
          }
          nearestMountedAncestor = nearestMountedAncestor.return;
        }
    }
    function attachPingListener(root2, wakeable, lanes) {
      var pingCache = root2.pingCache;
      if (null === pingCache) {
        pingCache = root2.pingCache = new PossiblyWeakMap();
        var threadIDs = /* @__PURE__ */ new Set();
        pingCache.set(wakeable, threadIDs);
      } else
        threadIDs = pingCache.get(wakeable), void 0 === threadIDs && (threadIDs = /* @__PURE__ */ new Set(), pingCache.set(wakeable, threadIDs));
      threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), root2 = pingSuspendedRoot.bind(null, root2, wakeable, lanes), wakeable.then(root2, root2));
    }
    function pingSuspendedRoot(root2, wakeable, pingedLanes) {
      var pingCache = root2.pingCache;
      null !== pingCache && pingCache.delete(wakeable);
      root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
      root2.warmLanes &= ~pingedLanes;
      workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (4 === workInProgressRootExitStatus || 3 === workInProgressRootExitStatus && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now() - globalMostRecentFallbackTime ? 0 === (executionContext & 2) && prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
      ensureRootIsScheduled(root2);
    }
    function retryTimedOutBoundary(boundaryFiber, retryLane) {
      0 === retryLane && (retryLane = claimNextRetryLane());
      boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
      null !== boundaryFiber && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
    }
    function retryDehydratedSuspenseBoundary(boundaryFiber) {
      var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
      null !== suspenseState && (retryLane = suspenseState.retryLane);
      retryTimedOutBoundary(boundaryFiber, retryLane);
    }
    function resolveRetryWakeable(boundaryFiber, wakeable) {
      var retryLane = 0;
      switch (boundaryFiber.tag) {
        case 31:
        case 13:
          var retryCache = boundaryFiber.stateNode;
          var suspenseState = boundaryFiber.memoizedState;
          null !== suspenseState && (retryLane = suspenseState.retryLane);
          break;
        case 19:
          retryCache = boundaryFiber.stateNode;
          break;
        case 22:
          retryCache = boundaryFiber.stateNode._retryCache;
          break;
        default:
          throw Error(formatProdErrorMessage(314));
      }
      null !== retryCache && retryCache.delete(wakeable);
      retryTimedOutBoundary(boundaryFiber, retryLane);
    }
    function scheduleCallback$1(priorityLevel, callback) {
      return scheduleCallback$3(priorityLevel, callback);
    }
    var firstScheduledRoot = null;
    var lastScheduledRoot = null;
    var didScheduleMicrotask = false;
    var mightHavePendingSyncWork = false;
    var isFlushingWork = false;
    var currentEventTransitionLane = 0;
    function ensureRootIsScheduled(root2) {
      root2 !== lastScheduledRoot && null === root2.next && (null === lastScheduledRoot ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
      mightHavePendingSyncWork = true;
      didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateRootScheduleTask());
    }
    function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
      if (!isFlushingWork && mightHavePendingSyncWork) {
        isFlushingWork = true;
        do {
          var didPerformSomeWork = false;
          for (var root$170 = firstScheduledRoot; null !== root$170; ) {
            if (!onlyLegacy)
              if (0 !== syncTransitionLanes) {
                var pendingLanes = root$170.pendingLanes;
                if (0 === pendingLanes) var JSCompiler_inline_result = 0;
                else {
                  var suspendedLanes = root$170.suspendedLanes, pingedLanes = root$170.pingedLanes;
                  JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
                  JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
                  JSCompiler_inline_result = JSCompiler_inline_result & 201326741 ? JSCompiler_inline_result & 201326741 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
                }
                0 !== JSCompiler_inline_result && (didPerformSomeWork = true, performSyncWorkOnRoot(root$170, JSCompiler_inline_result));
              } else
                JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(
                  root$170,
                  root$170 === workInProgressRoot ? JSCompiler_inline_result : 0,
                  null !== root$170.cancelPendingCommit || -1 !== root$170.timeoutHandle
                ), 0 === (JSCompiler_inline_result & 3) || checkIfRootIsPrerendering(root$170, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$170, JSCompiler_inline_result));
            root$170 = root$170.next;
          }
        } while (didPerformSomeWork);
        isFlushingWork = false;
      }
    }
    function processRootScheduleInImmediateTask() {
      processRootScheduleInMicrotask();
    }
    function processRootScheduleInMicrotask() {
      mightHavePendingSyncWork = didScheduleMicrotask = false;
      var syncTransitionLanes = 0;
      0 !== currentEventTransitionLane && shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane);
      for (var currentTime = now(), prev = null, root2 = firstScheduledRoot; null !== root2; ) {
        var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
        if (0 === nextLanes)
          root2.next = null, null === prev ? firstScheduledRoot = next : prev.next = next, null === next && (lastScheduledRoot = prev);
        else if (prev = root2, 0 !== syncTransitionLanes || 0 !== (nextLanes & 3))
          mightHavePendingSyncWork = true;
        root2 = next;
      }
      0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus || flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
      0 !== currentEventTransitionLane && (currentEventTransitionLane = 0);
    }
    function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
      for (var suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, expirationTimes = root2.expirationTimes, lanes = root2.pendingLanes & -62914561; 0 < lanes; ) {
        var index$5 = 31 - clz32(lanes), lane = 1 << index$5, expirationTime = expirationTimes[index$5];
        if (-1 === expirationTime) {
          if (0 === (lane & suspendedLanes) || 0 !== (lane & pingedLanes))
            expirationTimes[index$5] = computeExpirationTime(lane, currentTime);
        } else expirationTime <= currentTime && (root2.expiredLanes |= lane);
        lanes &= ~lane;
      }
      currentTime = workInProgressRoot;
      suspendedLanes = workInProgressRootRenderLanes;
      suspendedLanes = getNextLanes(
        root2,
        root2 === currentTime ? suspendedLanes : 0,
        null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
      );
      pingedLanes = root2.callbackNode;
      if (0 === suspendedLanes || root2 === currentTime && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
        return null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
      if (0 === (suspendedLanes & 3) || checkIfRootIsPrerendering(root2, suspendedLanes)) {
        currentTime = suspendedLanes & -suspendedLanes;
        if (currentTime === root2.callbackPriority) return currentTime;
        null !== pingedLanes && cancelCallback$1(pingedLanes);
        switch (lanesToEventPriority(suspendedLanes)) {
          case 2:
          case 8:
            suspendedLanes = UserBlockingPriority;
            break;
          case 32:
            suspendedLanes = NormalPriority$1;
            break;
          case 268435456:
            suspendedLanes = IdlePriority;
            break;
          default:
            suspendedLanes = NormalPriority$1;
        }
        pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
        suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
        root2.callbackPriority = currentTime;
        root2.callbackNode = suspendedLanes;
        return currentTime;
      }
      null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes);
      root2.callbackPriority = 2;
      root2.callbackNode = null;
      return 2;
    }
    function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
      if (0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus)
        return root2.callbackNode = null, root2.callbackPriority = 0, null;
      var originalCallbackNode = root2.callbackNode;
      if (flushPendingEffects() && root2.callbackNode !== originalCallbackNode)
        return null;
      var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
      workInProgressRootRenderLanes$jscomp$0 = getNextLanes(
        root2,
        root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0,
        null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
      );
      if (0 === workInProgressRootRenderLanes$jscomp$0) return null;
      performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
      scheduleTaskForRootDuringMicrotask(root2, now());
      return null != root2.callbackNode && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
    }
    function performSyncWorkOnRoot(root2, lanes) {
      if (flushPendingEffects()) return null;
      performWorkOnRoot(root2, lanes, true);
    }
    function scheduleImmediateRootScheduleTask() {
      scheduleMicrotask(function() {
        0 !== (executionContext & 6) ? scheduleCallback$3(
          ImmediatePriority,
          processRootScheduleInImmediateTask
        ) : processRootScheduleInMicrotask();
      });
    }
    function requestTransitionLane() {
      if (0 === currentEventTransitionLane) {
        var actionScopeLane = currentEntangledLane;
        0 === actionScopeLane && (actionScopeLane = nextTransitionUpdateLane, nextTransitionUpdateLane <<= 1, 0 === (nextTransitionUpdateLane & 261888) && (nextTransitionUpdateLane = 256));
        currentEventTransitionLane = actionScopeLane;
      }
      return currentEventTransitionLane;
    }
    function coerceFormActionProp(actionProp) {
      return null == actionProp || "symbol" === typeof actionProp || "boolean" === typeof actionProp ? null : "function" === typeof actionProp ? actionProp : sanitizeURL("" + actionProp);
    }
    function createFormDataWithSubmitter(form, submitter) {
      var temp = submitter.ownerDocument.createElement("input");
      temp.name = submitter.name;
      temp.value = submitter.value;
      form.id && temp.setAttribute("form", form.id);
      submitter.parentNode.insertBefore(temp, submitter);
      form = new FormData(form);
      temp.parentNode.removeChild(temp);
      return form;
    }
    function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
      if ("submit" === domEventName && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
        var action = coerceFormActionProp(
          (nativeEventTarget[internalPropsKey] || null).action
        ), submitter = nativeEvent.submitter;
        submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), null !== domEventName && (action = domEventName, submitter = null));
        var event = new SyntheticEvent(
          "action",
          "action",
          null,
          nativeEvent,
          nativeEventTarget
        );
        dispatchQueue.push({
          event,
          listeners: [
            {
              instance: null,
              listener: function() {
                if (nativeEvent.defaultPrevented) {
                  if (0 !== currentEventTransitionLane) {
                    var formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget);
                    startHostTransition(
                      maybeTargetInst,
                      {
                        pending: true,
                        data: formData,
                        method: nativeEventTarget.method,
                        action
                      },
                      null,
                      formData
                    );
                  }
                } else
                  "function" === typeof action && (event.preventDefault(), formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget), startHostTransition(
                    maybeTargetInst,
                    {
                      pending: true,
                      data: formData,
                      method: nativeEventTarget.method,
                      action
                    },
                    action,
                    formData
                  ));
              },
              currentTarget: nativeEventTarget
            }
          ]
        });
      }
    }
    for (i$jscomp$inline_1577 = 0; i$jscomp$inline_1577 < simpleEventPluginEvents.length; i$jscomp$inline_1577++) {
      eventName$jscomp$inline_1578 = simpleEventPluginEvents[i$jscomp$inline_1577], domEventName$jscomp$inline_1579 = eventName$jscomp$inline_1578.toLowerCase(), capitalizedEvent$jscomp$inline_1580 = eventName$jscomp$inline_1578[0].toUpperCase() + eventName$jscomp$inline_1578.slice(1);
      registerSimpleEvent(
        domEventName$jscomp$inline_1579,
        "on" + capitalizedEvent$jscomp$inline_1580
      );
    }
    var eventName$jscomp$inline_1578;
    var domEventName$jscomp$inline_1579;
    var capitalizedEvent$jscomp$inline_1580;
    var i$jscomp$inline_1577;
    registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
    registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
    registerSimpleEvent(ANIMATION_START, "onAnimationStart");
    registerSimpleEvent("dblclick", "onDoubleClick");
    registerSimpleEvent("focusin", "onFocus");
    registerSimpleEvent("focusout", "onBlur");
    registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
    registerSimpleEvent(TRANSITION_START, "onTransitionStart");
    registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
    registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
    registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
    registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
    registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
    registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
    registerTwoPhaseEvent(
      "onChange",
      "change click focusin focusout input keydown keyup selectionchange".split(" ")
    );
    registerTwoPhaseEvent(
      "onSelect",
      "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
        " "
      )
    );
    registerTwoPhaseEvent("onBeforeInput", [
      "compositionend",
      "keypress",
      "textInput",
      "paste"
    ]);
    registerTwoPhaseEvent(
      "onCompositionEnd",
      "compositionend focusout keydown keypress keyup mousedown".split(" ")
    );
    registerTwoPhaseEvent(
      "onCompositionStart",
      "compositionstart focusout keydown keypress keyup mousedown".split(" ")
    );
    registerTwoPhaseEvent(
      "onCompositionUpdate",
      "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
    );
    var mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
      " "
    );
    var nonDelegatedEvents = new Set(
      "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes)
    );
    function processDispatchQueue(dispatchQueue, eventSystemFlags) {
      eventSystemFlags = 0 !== (eventSystemFlags & 4);
      for (var i = 0; i < dispatchQueue.length; i++) {
        var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
        _dispatchQueue$i = _dispatchQueue$i.listeners;
        a: {
          var previousInstance = void 0;
          if (eventSystemFlags)
            for (var i$jscomp$0 = _dispatchQueue$i.length - 1; 0 <= i$jscomp$0; i$jscomp$0--) {
              var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
              _dispatchListeners$i = _dispatchListeners$i.listener;
              if (instance !== previousInstance && event.isPropagationStopped())
                break a;
              previousInstance = _dispatchListeners$i;
              event.currentTarget = currentTarget;
              try {
                previousInstance(event);
              } catch (error) {
                reportGlobalError(error);
              }
              event.currentTarget = null;
              previousInstance = instance;
            }
          else
            for (i$jscomp$0 = 0; i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
              _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
              instance = _dispatchListeners$i.instance;
              currentTarget = _dispatchListeners$i.currentTarget;
              _dispatchListeners$i = _dispatchListeners$i.listener;
              if (instance !== previousInstance && event.isPropagationStopped())
                break a;
              previousInstance = _dispatchListeners$i;
              event.currentTarget = currentTarget;
              try {
                previousInstance(event);
              } catch (error) {
                reportGlobalError(error);
              }
              event.currentTarget = null;
              previousInstance = instance;
            }
        }
      }
    }
    function listenToNonDelegatedEvent(domEventName, targetElement) {
      var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
      void 0 === JSCompiler_inline_result && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = /* @__PURE__ */ new Set());
      var listenerSetKey = domEventName + "__bubble";
      JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
    }
    function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
      var eventSystemFlags = 0;
      isCapturePhaseListener && (eventSystemFlags |= 4);
      addTrappedEventListener(
        target,
        domEventName,
        eventSystemFlags,
        isCapturePhaseListener
      );
    }
    var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
    function listenToAllSupportedEvents(rootContainerElement) {
      if (!rootContainerElement[listeningMarker]) {
        rootContainerElement[listeningMarker] = true;
        allNativeEvents.forEach(function(domEventName) {
          "selectionchange" !== domEventName && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
        });
        var ownerDocument = 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
        null === ownerDocument || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
      }
    }
    function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
      switch (getEventPriority(domEventName)) {
        case 2:
          var listenerWrapper = dispatchDiscreteEvent;
          break;
        case 8:
          listenerWrapper = dispatchContinuousEvent;
          break;
        default:
          listenerWrapper = dispatchEvent;
      }
      eventSystemFlags = listenerWrapper.bind(
        null,
        domEventName,
        eventSystemFlags,
        targetContainer
      );
      listenerWrapper = void 0;
      !passiveBrowserEventsSupported || "touchstart" !== domEventName && "touchmove" !== domEventName && "wheel" !== domEventName || (listenerWrapper = true);
      isCapturePhaseListener ? void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
        capture: true,
        passive: listenerWrapper
      }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
        passive: listenerWrapper
      }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
    }
    function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
      var ancestorInst = targetInst$jscomp$0;
      if (0 === (eventSystemFlags & 1) && 0 === (eventSystemFlags & 2) && null !== targetInst$jscomp$0)
        a: for (; ; ) {
          if (null === targetInst$jscomp$0) return;
          var nodeTag = targetInst$jscomp$0.tag;
          if (3 === nodeTag || 4 === nodeTag) {
            var container = targetInst$jscomp$0.stateNode.containerInfo;
            if (container === targetContainer) break;
            if (4 === nodeTag)
              for (nodeTag = targetInst$jscomp$0.return; null !== nodeTag; ) {
                var grandTag = nodeTag.tag;
                if ((3 === grandTag || 4 === grandTag) && nodeTag.stateNode.containerInfo === targetContainer)
                  return;
                nodeTag = nodeTag.return;
              }
            for (; null !== container; ) {
              nodeTag = getClosestInstanceFromNode(container);
              if (null === nodeTag) return;
              grandTag = nodeTag.tag;
              if (5 === grandTag || 6 === grandTag || 26 === grandTag || 27 === grandTag) {
                targetInst$jscomp$0 = ancestorInst = nodeTag;
                continue a;
              }
              container = container.parentNode;
            }
          }
          targetInst$jscomp$0 = targetInst$jscomp$0.return;
        }
      batchedUpdates$1(function() {
        var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
        a: {
          var reactName = topLevelEventsToReactNames.get(domEventName);
          if (void 0 !== reactName) {
            var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
            switch (domEventName) {
              case "keypress":
                if (0 === getEventCharCode(nativeEvent)) break a;
              case "keydown":
              case "keyup":
                SyntheticEventCtor = SyntheticKeyboardEvent;
                break;
              case "focusin":
                reactEventType = "focus";
                SyntheticEventCtor = SyntheticFocusEvent;
                break;
              case "focusout":
                reactEventType = "blur";
                SyntheticEventCtor = SyntheticFocusEvent;
                break;
              case "beforeblur":
              case "afterblur":
                SyntheticEventCtor = SyntheticFocusEvent;
                break;
              case "click":
                if (2 === nativeEvent.button) break a;
              case "auxclick":
              case "dblclick":
              case "mousedown":
              case "mousemove":
              case "mouseup":
              case "mouseout":
              case "mouseover":
              case "contextmenu":
                SyntheticEventCtor = SyntheticMouseEvent;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                SyntheticEventCtor = SyntheticDragEvent;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                SyntheticEventCtor = SyntheticTouchEvent;
                break;
              case ANIMATION_END:
              case ANIMATION_ITERATION:
              case ANIMATION_START:
                SyntheticEventCtor = SyntheticAnimationEvent;
                break;
              case TRANSITION_END:
                SyntheticEventCtor = SyntheticTransitionEvent;
                break;
              case "scroll":
              case "scrollend":
                SyntheticEventCtor = SyntheticUIEvent;
                break;
              case "wheel":
                SyntheticEventCtor = SyntheticWheelEvent;
                break;
              case "copy":
              case "cut":
              case "paste":
                SyntheticEventCtor = SyntheticClipboardEvent;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                SyntheticEventCtor = SyntheticPointerEvent;
                break;
              case "toggle":
              case "beforetoggle":
                SyntheticEventCtor = SyntheticToggleEvent;
            }
            var inCapturePhase = 0 !== (eventSystemFlags & 4), accumulateTargetOnly = !inCapturePhase && ("scroll" === domEventName || "scrollend" === domEventName), reactEventName = inCapturePhase ? null !== reactName ? reactName + "Capture" : null : reactName;
            inCapturePhase = [];
            for (var instance = targetInst, lastHostComponent; null !== instance; ) {
              var _instance = instance;
              lastHostComponent = _instance.stateNode;
              _instance = _instance.tag;
              5 !== _instance && 26 !== _instance && 27 !== _instance || null === lastHostComponent || null === reactEventName || (_instance = getListener(instance, reactEventName), null != _instance && inCapturePhase.push(
                createDispatchListener(instance, _instance, lastHostComponent)
              ));
              if (accumulateTargetOnly) break;
              instance = instance.return;
            }
            0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(
              reactName,
              reactEventType,
              null,
              nativeEvent,
              nativeEventTarget
            ), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
          }
        }
        if (0 === (eventSystemFlags & 7)) {
          a: {
            reactName = "mouseover" === domEventName || "pointerover" === domEventName;
            SyntheticEventCtor = "mouseout" === domEventName || "pointerout" === domEventName;
            if (reactName && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
              break a;
            if (SyntheticEventCtor || reactName) {
              reactName = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (reactName = nativeEventTarget.ownerDocument) ? reactName.defaultView || reactName.parentWindow : window;
              if (SyntheticEventCtor) {
                if (reactEventType = nativeEvent.relatedTarget || nativeEvent.toElement, SyntheticEventCtor = targetInst, reactEventType = reactEventType ? getClosestInstanceFromNode(reactEventType) : null, null !== reactEventType && (accumulateTargetOnly = getNearestMountedFiber(reactEventType), inCapturePhase = reactEventType.tag, reactEventType !== accumulateTargetOnly || 5 !== inCapturePhase && 27 !== inCapturePhase && 6 !== inCapturePhase))
                  reactEventType = null;
              } else SyntheticEventCtor = null, reactEventType = targetInst;
              if (SyntheticEventCtor !== reactEventType) {
                inCapturePhase = SyntheticMouseEvent;
                _instance = "onMouseLeave";
                reactEventName = "onMouseEnter";
                instance = "mouse";
                if ("pointerout" === domEventName || "pointerover" === domEventName)
                  inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
                accumulateTargetOnly = null == SyntheticEventCtor ? reactName : getNodeFromInstance(SyntheticEventCtor);
                lastHostComponent = null == reactEventType ? reactName : getNodeFromInstance(reactEventType);
                reactName = new inCapturePhase(
                  _instance,
                  instance + "leave",
                  SyntheticEventCtor,
                  nativeEvent,
                  nativeEventTarget
                );
                reactName.target = accumulateTargetOnly;
                reactName.relatedTarget = lastHostComponent;
                _instance = null;
                getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(
                  reactEventName,
                  instance + "enter",
                  reactEventType,
                  nativeEvent,
                  nativeEventTarget
                ), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
                accumulateTargetOnly = _instance;
                if (SyntheticEventCtor && reactEventType)
                  b: {
                    inCapturePhase = getParent;
                    reactEventName = SyntheticEventCtor;
                    instance = reactEventType;
                    lastHostComponent = 0;
                    for (_instance = reactEventName; _instance; _instance = inCapturePhase(_instance))
                      lastHostComponent++;
                    _instance = 0;
                    for (var tempB = instance; tempB; tempB = inCapturePhase(tempB))
                      _instance++;
                    for (; 0 < lastHostComponent - _instance; )
                      reactEventName = inCapturePhase(reactEventName), lastHostComponent--;
                    for (; 0 < _instance - lastHostComponent; )
                      instance = inCapturePhase(instance), _instance--;
                    for (; lastHostComponent--; ) {
                      if (reactEventName === instance || null !== instance && reactEventName === instance.alternate) {
                        inCapturePhase = reactEventName;
                        break b;
                      }
                      reactEventName = inCapturePhase(reactEventName);
                      instance = inCapturePhase(instance);
                    }
                    inCapturePhase = null;
                  }
                else inCapturePhase = null;
                null !== SyntheticEventCtor && accumulateEnterLeaveListenersForEvent(
                  dispatchQueue,
                  reactName,
                  SyntheticEventCtor,
                  inCapturePhase,
                  false
                );
                null !== reactEventType && null !== accumulateTargetOnly && accumulateEnterLeaveListenersForEvent(
                  dispatchQueue,
                  accumulateTargetOnly,
                  reactEventType,
                  inCapturePhase,
                  true
                );
              }
            }
          }
          a: {
            reactName = targetInst ? getNodeFromInstance(targetInst) : window;
            SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
            if ("select" === SyntheticEventCtor || "input" === SyntheticEventCtor && "file" === reactName.type)
              var getTargetInstFunc = getTargetInstForChangeEvent;
            else if (isTextInputElement(reactName))
              if (isInputEventSupported)
                getTargetInstFunc = getTargetInstForInputOrChangeEvent;
              else {
                getTargetInstFunc = getTargetInstForInputEventPolyfill;
                var handleEventFunc = handleEventsForInputEventPolyfill;
              }
            else
              SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || "input" !== SyntheticEventCtor.toLowerCase() || "checkbox" !== reactName.type && "radio" !== reactName.type ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
            if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
              createAndAccumulateChangeEvent(
                dispatchQueue,
                getTargetInstFunc,
                nativeEvent,
                nativeEventTarget
              );
              break a;
            }
            handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
            "focusout" === domEventName && targetInst && "number" === reactName.type && null != targetInst.memoizedProps.value && setDefaultValue(reactName, "number", reactName.value);
          }
          handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
          switch (domEventName) {
            case "focusin":
              if (isTextInputElement(handleEventFunc) || "true" === handleEventFunc.contentEditable)
                activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
              break;
            case "focusout":
              lastSelection = activeElementInst = activeElement = null;
              break;
            case "mousedown":
              mouseDown = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              mouseDown = false;
              constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
              break;
            case "selectionchange":
              if (skipSelectionChangeEvent) break;
            case "keydown":
            case "keyup":
              constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
          }
          var fallbackData;
          if (canUseCompositionEvent)
            b: {
              switch (domEventName) {
                case "compositionstart":
                  var eventType = "onCompositionStart";
                  break b;
                case "compositionend":
                  eventType = "onCompositionEnd";
                  break b;
                case "compositionupdate":
                  eventType = "onCompositionUpdate";
                  break b;
              }
              eventType = void 0;
            }
          else
            isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : "keydown" === domEventName && 229 === nativeEvent.keyCode && (eventType = "onCompositionStart");
          eventType && (useFallbackCompositionData && "ko" !== nativeEvent.locale && (isComposing || "onCompositionStart" !== eventType ? "onCompositionEnd" === eventType && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = "value" in root ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(
            eventType,
            domEventName,
            null,
            nativeEvent,
            nativeEventTarget
          ), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), null !== fallbackData && (eventType.data = fallbackData))));
          if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
            eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent(
              "onBeforeInput",
              "beforeinput",
              null,
              nativeEvent,
              nativeEventTarget
            ), dispatchQueue.push({
              event: handleEventFunc,
              listeners: eventType
            }), handleEventFunc.data = fallbackData);
          extractEvents$1(
            dispatchQueue,
            domEventName,
            targetInst,
            nativeEvent,
            nativeEventTarget
          );
        }
        processDispatchQueue(dispatchQueue, eventSystemFlags);
      });
    }
    function createDispatchListener(instance, listener, currentTarget) {
      return {
        instance,
        listener,
        currentTarget
      };
    }
    function accumulateTwoPhaseListeners(targetFiber, reactName) {
      for (var captureName = reactName + "Capture", listeners = []; null !== targetFiber; ) {
        var _instance2 = targetFiber, stateNode = _instance2.stateNode;
        _instance2 = _instance2.tag;
        5 !== _instance2 && 26 !== _instance2 && 27 !== _instance2 || null === stateNode || (_instance2 = getListener(targetFiber, captureName), null != _instance2 && listeners.unshift(
          createDispatchListener(targetFiber, _instance2, stateNode)
        ), _instance2 = getListener(targetFiber, reactName), null != _instance2 && listeners.push(
          createDispatchListener(targetFiber, _instance2, stateNode)
        ));
        if (3 === targetFiber.tag) return listeners;
        targetFiber = targetFiber.return;
      }
      return [];
    }
    function getParent(inst) {
      if (null === inst) return null;
      do
        inst = inst.return;
      while (inst && 5 !== inst.tag && 27 !== inst.tag);
      return inst ? inst : null;
    }
    function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
      for (var registrationName = event._reactName, listeners = []; null !== target && target !== common; ) {
        var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
        _instance3 = _instance3.tag;
        if (null !== alternate && alternate === common) break;
        5 !== _instance3 && 26 !== _instance3 && 27 !== _instance3 || null === stateNode || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), null != stateNode && listeners.unshift(
          createDispatchListener(target, stateNode, alternate)
        )) : inCapturePhase || (stateNode = getListener(target, registrationName), null != stateNode && listeners.push(
          createDispatchListener(target, stateNode, alternate)
        )));
        target = target.return;
      }
      0 !== listeners.length && dispatchQueue.push({ event, listeners });
    }
    var NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
    var NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
    function normalizeMarkupForTextOrAttribute(markup) {
      return ("string" === typeof markup ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
    }
    function checkForUnmatchedText(serverText, clientText) {
      clientText = normalizeMarkupForTextOrAttribute(clientText);
      return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
    }
    function setProp(domElement, tag, key, value, props, prevValue) {
      switch (key) {
        case "children":
          "string" === typeof value ? "body" === tag || "textarea" === tag && "" === value || setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && "body" !== tag && setTextContent(domElement, "" + value);
          break;
        case "className":
          setValueForKnownAttribute(domElement, "class", value);
          break;
        case "tabIndex":
          setValueForKnownAttribute(domElement, "tabindex", value);
          break;
        case "dir":
        case "role":
        case "viewBox":
        case "width":
        case "height":
          setValueForKnownAttribute(domElement, key, value);
          break;
        case "style":
          setValueForStyles(domElement, value, prevValue);
          break;
        case "data":
          if ("object" !== tag) {
            setValueForKnownAttribute(domElement, "data", value);
            break;
          }
        case "src":
        case "href":
          if ("" === value && ("a" !== tag || "href" !== key)) {
            domElement.removeAttribute(key);
            break;
          }
          if (null == value || "function" === typeof value || "symbol" === typeof value || "boolean" === typeof value) {
            domElement.removeAttribute(key);
            break;
          }
          value = sanitizeURL("" + value);
          domElement.setAttribute(key, value);
          break;
        case "action":
        case "formAction":
          if ("function" === typeof value) {
            domElement.setAttribute(
              key,
              "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
            );
            break;
          } else
            "function" === typeof prevValue && ("formAction" === key ? ("input" !== tag && setProp(domElement, tag, "name", props.name, props, null), setProp(
              domElement,
              tag,
              "formEncType",
              props.formEncType,
              props,
              null
            ), setProp(
              domElement,
              tag,
              "formMethod",
              props.formMethod,
              props,
              null
            ), setProp(
              domElement,
              tag,
              "formTarget",
              props.formTarget,
              props,
              null
            )) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
          if (null == value || "symbol" === typeof value || "boolean" === typeof value) {
            domElement.removeAttribute(key);
            break;
          }
          value = sanitizeURL("" + value);
          domElement.setAttribute(key, value);
          break;
        case "onClick":
          null != value && (domElement.onclick = noop$1);
          break;
        case "onScroll":
          null != value && listenToNonDelegatedEvent("scroll", domElement);
          break;
        case "onScrollEnd":
          null != value && listenToNonDelegatedEvent("scrollend", domElement);
          break;
        case "dangerouslySetInnerHTML":
          if (null != value) {
            if ("object" !== typeof value || !("__html" in value))
              throw Error(formatProdErrorMessage(61));
            key = value.__html;
            if (null != key) {
              if (null != props.children) throw Error(formatProdErrorMessage(60));
              domElement.innerHTML = key;
            }
          }
          break;
        case "multiple":
          domElement.multiple = value && "function" !== typeof value && "symbol" !== typeof value;
          break;
        case "muted":
          domElement.muted = value && "function" !== typeof value && "symbol" !== typeof value;
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "defaultValue":
        case "defaultChecked":
        case "innerHTML":
        case "ref":
          break;
        case "autoFocus":
          break;
        case "xlinkHref":
          if (null == value || "function" === typeof value || "boolean" === typeof value || "symbol" === typeof value) {
            domElement.removeAttribute("xlink:href");
            break;
          }
          key = sanitizeURL("" + value);
          domElement.setAttributeNS(
            "http://www.w3.org/1999/xlink",
            "xlink:href",
            key
          );
          break;
        case "contentEditable":
        case "spellCheck":
        case "draggable":
        case "value":
        case "autoReverse":
        case "externalResourcesRequired":
        case "focusable":
        case "preserveAlpha":
          null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "" + value) : domElement.removeAttribute(key);
          break;
        case "inert":
        case "allowFullScreen":
        case "async":
        case "autoPlay":
        case "controls":
        case "default":
        case "defer":
        case "disabled":
        case "disablePictureInPicture":
        case "disableRemotePlayback":
        case "formNoValidate":
        case "hidden":
        case "loop":
        case "noModule":
        case "noValidate":
        case "open":
        case "playsInline":
        case "readOnly":
        case "required":
        case "reversed":
        case "scoped":
        case "seamless":
        case "itemScope":
          value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
          break;
        case "capture":
        case "download":
          true === value ? domElement.setAttribute(key, "") : false !== value && null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
          break;
        case "cols":
        case "rows":
        case "size":
        case "span":
          null != value && "function" !== typeof value && "symbol" !== typeof value && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
          break;
        case "rowSpan":
        case "start":
          null == value || "function" === typeof value || "symbol" === typeof value || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
          break;
        case "popover":
          listenToNonDelegatedEvent("beforetoggle", domElement);
          listenToNonDelegatedEvent("toggle", domElement);
          setValueForAttribute(domElement, "popover", value);
          break;
        case "xlinkActuate":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:actuate",
            value
          );
          break;
        case "xlinkArcrole":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:arcrole",
            value
          );
          break;
        case "xlinkRole":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:role",
            value
          );
          break;
        case "xlinkShow":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:show",
            value
          );
          break;
        case "xlinkTitle":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:title",
            value
          );
          break;
        case "xlinkType":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/1999/xlink",
            "xlink:type",
            value
          );
          break;
        case "xmlBase":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/XML/1998/namespace",
            "xml:base",
            value
          );
          break;
        case "xmlLang":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/XML/1998/namespace",
            "xml:lang",
            value
          );
          break;
        case "xmlSpace":
          setValueForNamespacedAttribute(
            domElement,
            "http://www.w3.org/XML/1998/namespace",
            "xml:space",
            value
          );
          break;
        case "is":
          setValueForAttribute(domElement, "is", value);
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          if (!(2 < key.length) || "o" !== key[0] && "O" !== key[0] || "n" !== key[1] && "N" !== key[1])
            key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
      }
    }
    function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
      switch (key) {
        case "style":
          setValueForStyles(domElement, value, prevValue);
          break;
        case "dangerouslySetInnerHTML":
          if (null != value) {
            if ("object" !== typeof value || !("__html" in value))
              throw Error(formatProdErrorMessage(61));
            key = value.__html;
            if (null != key) {
              if (null != props.children) throw Error(formatProdErrorMessage(60));
              domElement.innerHTML = key;
            }
          }
          break;
        case "children":
          "string" === typeof value ? setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && setTextContent(domElement, "" + value);
          break;
        case "onScroll":
          null != value && listenToNonDelegatedEvent("scroll", domElement);
          break;
        case "onScrollEnd":
          null != value && listenToNonDelegatedEvent("scrollend", domElement);
          break;
        case "onClick":
          null != value && (domElement.onclick = noop$1);
          break;
        case "suppressContentEditableWarning":
        case "suppressHydrationWarning":
        case "innerHTML":
        case "ref":
          break;
        case "innerText":
        case "textContent":
          break;
        default:
          if (!registrationNameDependencies.hasOwnProperty(key))
            a: {
              if ("o" === key[0] && "n" === key[1] && (props = key.endsWith("Capture"), tag = key.slice(2, props ? key.length - 7 : void 0), prevValue = domElement[internalPropsKey] || null, prevValue = null != prevValue ? prevValue[key] : null, "function" === typeof prevValue && domElement.removeEventListener(tag, prevValue, props), "function" === typeof value)) {
                "function" !== typeof prevValue && null !== prevValue && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
                domElement.addEventListener(tag, value, props);
                break a;
              }
              key in domElement ? domElement[key] = value : true === value ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
            }
      }
    }
    function setInitialProperties(domElement, tag, props) {
      switch (tag) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "img":
          listenToNonDelegatedEvent("error", domElement);
          listenToNonDelegatedEvent("load", domElement);
          var hasSrc = false, hasSrcSet = false, propKey;
          for (propKey in props)
            if (props.hasOwnProperty(propKey)) {
              var propValue = props[propKey];
              if (null != propValue)
                switch (propKey) {
                  case "src":
                    hasSrc = true;
                    break;
                  case "srcSet":
                    hasSrcSet = true;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    throw Error(formatProdErrorMessage(137, tag));
                  default:
                    setProp(domElement, tag, propKey, propValue, props, null);
                }
            }
          hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
          hasSrc && setProp(domElement, tag, "src", props.src, props, null);
          return;
        case "input":
          listenToNonDelegatedEvent("invalid", domElement);
          var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
          for (hasSrc in props)
            if (props.hasOwnProperty(hasSrc)) {
              var propValue$184 = props[hasSrc];
              if (null != propValue$184)
                switch (hasSrc) {
                  case "name":
                    hasSrcSet = propValue$184;
                    break;
                  case "type":
                    propValue = propValue$184;
                    break;
                  case "checked":
                    checked = propValue$184;
                    break;
                  case "defaultChecked":
                    defaultChecked = propValue$184;
                    break;
                  case "value":
                    propKey = propValue$184;
                    break;
                  case "defaultValue":
                    defaultValue = propValue$184;
                    break;
                  case "children":
                  case "dangerouslySetInnerHTML":
                    if (null != propValue$184)
                      throw Error(formatProdErrorMessage(137, tag));
                    break;
                  default:
                    setProp(domElement, tag, hasSrc, propValue$184, props, null);
                }
            }
          initInput(
            domElement,
            propKey,
            defaultValue,
            checked,
            defaultChecked,
            propValue,
            hasSrcSet,
            false
          );
          return;
        case "select":
          listenToNonDelegatedEvent("invalid", domElement);
          hasSrc = propValue = propKey = null;
          for (hasSrcSet in props)
            if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], null != defaultValue))
              switch (hasSrcSet) {
                case "value":
                  propKey = defaultValue;
                  break;
                case "defaultValue":
                  propValue = defaultValue;
                  break;
                case "multiple":
                  hasSrc = defaultValue;
                default:
                  setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
              }
          tag = propKey;
          props = propValue;
          domElement.multiple = !!hasSrc;
          null != tag ? updateOptions(domElement, !!hasSrc, tag, false) : null != props && updateOptions(domElement, !!hasSrc, props, true);
          return;
        case "textarea":
          listenToNonDelegatedEvent("invalid", domElement);
          propKey = hasSrcSet = hasSrc = null;
          for (propValue in props)
            if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], null != defaultValue))
              switch (propValue) {
                case "value":
                  hasSrc = defaultValue;
                  break;
                case "defaultValue":
                  hasSrcSet = defaultValue;
                  break;
                case "children":
                  propKey = defaultValue;
                  break;
                case "dangerouslySetInnerHTML":
                  if (null != defaultValue) throw Error(formatProdErrorMessage(91));
                  break;
                default:
                  setProp(domElement, tag, propValue, defaultValue, props, null);
              }
          initTextarea(domElement, hasSrc, hasSrcSet, propKey);
          return;
        case "option":
          for (checked in props)
            if (props.hasOwnProperty(checked) && (hasSrc = props[checked], null != hasSrc))
              switch (checked) {
                case "selected":
                  domElement.selected = hasSrc && "function" !== typeof hasSrc && "symbol" !== typeof hasSrc;
                  break;
                default:
                  setProp(domElement, tag, checked, hasSrc, props, null);
              }
          return;
        case "dialog":
          listenToNonDelegatedEvent("beforetoggle", domElement);
          listenToNonDelegatedEvent("toggle", domElement);
          listenToNonDelegatedEvent("cancel", domElement);
          listenToNonDelegatedEvent("close", domElement);
          break;
        case "iframe":
        case "object":
          listenToNonDelegatedEvent("load", domElement);
          break;
        case "video":
        case "audio":
          for (hasSrc = 0; hasSrc < mediaEventTypes.length; hasSrc++)
            listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
          break;
        case "image":
          listenToNonDelegatedEvent("error", domElement);
          listenToNonDelegatedEvent("load", domElement);
          break;
        case "details":
          listenToNonDelegatedEvent("toggle", domElement);
          break;
        case "embed":
        case "source":
        case "link":
          listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
        case "area":
        case "base":
        case "br":
        case "col":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "track":
        case "wbr":
        case "menuitem":
          for (defaultChecked in props)
            if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], null != hasSrc))
              switch (defaultChecked) {
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(formatProdErrorMessage(137, tag));
                default:
                  setProp(domElement, tag, defaultChecked, hasSrc, props, null);
              }
          return;
        default:
          if (isCustomElement(tag)) {
            for (propValue$184 in props)
              props.hasOwnProperty(propValue$184) && (hasSrc = props[propValue$184], void 0 !== hasSrc && setPropOnCustomElement(
                domElement,
                tag,
                propValue$184,
                hasSrc,
                props,
                void 0
              ));
            return;
          }
      }
      for (defaultValue in props)
        props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], null != hasSrc && setProp(domElement, tag, defaultValue, hasSrc, props, null));
    }
    function updateProperties(domElement, tag, lastProps, nextProps) {
      switch (tag) {
        case "div":
        case "span":
        case "svg":
        case "path":
        case "a":
        case "g":
        case "p":
        case "li":
          break;
        case "input":
          var name = null, type = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
          for (propKey in lastProps) {
            var lastProp = lastProps[propKey];
            if (lastProps.hasOwnProperty(propKey) && null != lastProp)
              switch (propKey) {
                case "checked":
                  break;
                case "value":
                  break;
                case "defaultValue":
                  lastDefaultValue = lastProp;
                default:
                  nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
              }
          }
          for (var propKey$201 in nextProps) {
            var propKey = nextProps[propKey$201];
            lastProp = lastProps[propKey$201];
            if (nextProps.hasOwnProperty(propKey$201) && (null != propKey || null != lastProp))
              switch (propKey$201) {
                case "type":
                  type = propKey;
                  break;
                case "name":
                  name = propKey;
                  break;
                case "checked":
                  checked = propKey;
                  break;
                case "defaultChecked":
                  defaultChecked = propKey;
                  break;
                case "value":
                  value = propKey;
                  break;
                case "defaultValue":
                  defaultValue = propKey;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (null != propKey)
                    throw Error(formatProdErrorMessage(137, tag));
                  break;
                default:
                  propKey !== lastProp && setProp(
                    domElement,
                    tag,
                    propKey$201,
                    propKey,
                    nextProps,
                    lastProp
                  );
              }
          }
          updateInput(
            domElement,
            value,
            defaultValue,
            lastDefaultValue,
            checked,
            defaultChecked,
            type,
            name
          );
          return;
        case "select":
          propKey = value = defaultValue = propKey$201 = null;
          for (type in lastProps)
            if (lastDefaultValue = lastProps[type], lastProps.hasOwnProperty(type) && null != lastDefaultValue)
              switch (type) {
                case "value":
                  break;
                case "multiple":
                  propKey = lastDefaultValue;
                default:
                  nextProps.hasOwnProperty(type) || setProp(
                    domElement,
                    tag,
                    type,
                    null,
                    nextProps,
                    lastDefaultValue
                  );
              }
          for (name in nextProps)
            if (type = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (null != type || null != lastDefaultValue))
              switch (name) {
                case "value":
                  propKey$201 = type;
                  break;
                case "defaultValue":
                  defaultValue = type;
                  break;
                case "multiple":
                  value = type;
                default:
                  type !== lastDefaultValue && setProp(
                    domElement,
                    tag,
                    name,
                    type,
                    nextProps,
                    lastDefaultValue
                  );
              }
          tag = defaultValue;
          lastProps = value;
          nextProps = propKey;
          null != propKey$201 ? updateOptions(domElement, !!lastProps, propKey$201, false) : !!nextProps !== !!lastProps && (null != tag ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
          return;
        case "textarea":
          propKey = propKey$201 = null;
          for (defaultValue in lastProps)
            if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && null != name && !nextProps.hasOwnProperty(defaultValue))
              switch (defaultValue) {
                case "value":
                  break;
                case "children":
                  break;
                default:
                  setProp(domElement, tag, defaultValue, null, nextProps, name);
              }
          for (value in nextProps)
            if (name = nextProps[value], type = lastProps[value], nextProps.hasOwnProperty(value) && (null != name || null != type))
              switch (value) {
                case "value":
                  propKey$201 = name;
                  break;
                case "defaultValue":
                  propKey = name;
                  break;
                case "children":
                  break;
                case "dangerouslySetInnerHTML":
                  if (null != name) throw Error(formatProdErrorMessage(91));
                  break;
                default:
                  name !== type && setProp(domElement, tag, value, name, nextProps, type);
              }
          updateTextarea(domElement, propKey$201, propKey);
          return;
        case "option":
          for (var propKey$217 in lastProps)
            if (propKey$201 = lastProps[propKey$217], lastProps.hasOwnProperty(propKey$217) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$217))
              switch (propKey$217) {
                case "selected":
                  domElement.selected = false;
                  break;
                default:
                  setProp(
                    domElement,
                    tag,
                    propKey$217,
                    null,
                    nextProps,
                    propKey$201
                  );
              }
          for (lastDefaultValue in nextProps)
            if (propKey$201 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$201 !== propKey && (null != propKey$201 || null != propKey))
              switch (lastDefaultValue) {
                case "selected":
                  domElement.selected = propKey$201 && "function" !== typeof propKey$201 && "symbol" !== typeof propKey$201;
                  break;
                default:
                  setProp(
                    domElement,
                    tag,
                    lastDefaultValue,
                    propKey$201,
                    nextProps,
                    propKey
                  );
              }
          return;
        case "img":
        case "link":
        case "area":
        case "base":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "keygen":
        case "meta":
        case "param":
        case "source":
        case "track":
        case "wbr":
        case "menuitem":
          for (var propKey$222 in lastProps)
            propKey$201 = lastProps[propKey$222], lastProps.hasOwnProperty(propKey$222) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$222) && setProp(domElement, tag, propKey$222, null, nextProps, propKey$201);
          for (checked in nextProps)
            if (propKey$201 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$201 !== propKey && (null != propKey$201 || null != propKey))
              switch (checked) {
                case "children":
                case "dangerouslySetInnerHTML":
                  if (null != propKey$201)
                    throw Error(formatProdErrorMessage(137, tag));
                  break;
                default:
                  setProp(
                    domElement,
                    tag,
                    checked,
                    propKey$201,
                    nextProps,
                    propKey
                  );
              }
          return;
        default:
          if (isCustomElement(tag)) {
            for (var propKey$227 in lastProps)
              propKey$201 = lastProps[propKey$227], lastProps.hasOwnProperty(propKey$227) && void 0 !== propKey$201 && !nextProps.hasOwnProperty(propKey$227) && setPropOnCustomElement(
                domElement,
                tag,
                propKey$227,
                void 0,
                nextProps,
                propKey$201
              );
            for (defaultChecked in nextProps)
              propKey$201 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$201 === propKey || void 0 === propKey$201 && void 0 === propKey || setPropOnCustomElement(
                domElement,
                tag,
                defaultChecked,
                propKey$201,
                nextProps,
                propKey
              );
            return;
          }
      }
      for (var propKey$232 in lastProps)
        propKey$201 = lastProps[propKey$232], lastProps.hasOwnProperty(propKey$232) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$232) && setProp(domElement, tag, propKey$232, null, nextProps, propKey$201);
      for (lastProp in nextProps)
        propKey$201 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$201 === propKey || null == propKey$201 && null == propKey || setProp(domElement, tag, lastProp, propKey$201, nextProps, propKey);
    }
    function isLikelyStaticResource(initiatorType) {
      switch (initiatorType) {
        case "css":
        case "script":
        case "font":
        case "img":
        case "image":
        case "input":
        case "link":
          return true;
        default:
          return false;
      }
    }
    function estimateBandwidth() {
      if ("function" === typeof performance.getEntriesByType) {
        for (var count = 0, bits = 0, resourceEntries = performance.getEntriesByType("resource"), i = 0; i < resourceEntries.length; i++) {
          var entry = resourceEntries[i], transferSize = entry.transferSize, initiatorType = entry.initiatorType, duration = entry.duration;
          if (transferSize && duration && isLikelyStaticResource(initiatorType)) {
            initiatorType = 0;
            duration = entry.responseEnd;
            for (i += 1; i < resourceEntries.length; i++) {
              var overlapEntry = resourceEntries[i], overlapStartTime = overlapEntry.startTime;
              if (overlapStartTime > duration) break;
              var overlapTransferSize = overlapEntry.transferSize, overlapInitiatorType = overlapEntry.initiatorType;
              overlapTransferSize && isLikelyStaticResource(overlapInitiatorType) && (overlapEntry = overlapEntry.responseEnd, initiatorType += overlapTransferSize * (overlapEntry < duration ? 1 : (duration - overlapStartTime) / (overlapEntry - overlapStartTime)));
            }
            --i;
            bits += 8 * (transferSize + initiatorType) / (entry.duration / 1e3);
            count++;
            if (10 < count) break;
          }
        }
        if (0 < count) return bits / count / 1e6;
      }
      return navigator.connection && (count = navigator.connection.downlink, "number" === typeof count) ? count : 5;
    }
    var eventsEnabled = null;
    var selectionInformation = null;
    function getOwnerDocumentFromRootContainer(rootContainerElement) {
      return 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
    }
    function getOwnHostContext(namespaceURI) {
      switch (namespaceURI) {
        case "http://www.w3.org/2000/svg":
          return 1;
        case "http://www.w3.org/1998/Math/MathML":
          return 2;
        default:
          return 0;
      }
    }
    function getChildHostContextProd(parentNamespace, type) {
      if (0 === parentNamespace)
        switch (type) {
          case "svg":
            return 1;
          case "math":
            return 2;
          default:
            return 0;
        }
      return 1 === parentNamespace && "foreignObject" === type ? 0 : parentNamespace;
    }
    function shouldSetTextContent(type, props) {
      return "textarea" === type || "noscript" === type || "string" === typeof props.children || "number" === typeof props.children || "bigint" === typeof props.children || "object" === typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && null != props.dangerouslySetInnerHTML.__html;
    }
    var currentPopstateTransitionEvent = null;
    function shouldAttemptEagerTransition() {
      var event = window.event;
      if (event && "popstate" === event.type) {
        if (event === currentPopstateTransitionEvent) return false;
        currentPopstateTransitionEvent = event;
        return true;
      }
      currentPopstateTransitionEvent = null;
      return false;
    }
    var scheduleTimeout = "function" === typeof setTimeout ? setTimeout : void 0;
    var cancelTimeout = "function" === typeof clearTimeout ? clearTimeout : void 0;
    var localPromise = "function" === typeof Promise ? Promise : void 0;
    var scheduleMicrotask = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof localPromise ? function(callback) {
      return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
    } : scheduleTimeout;
    function handleErrorInNextTick(error) {
      setTimeout(function() {
        throw error;
      });
    }
    function isSingletonScope(type) {
      return "head" === type;
    }
    function clearHydrationBoundary(parentInstance, hydrationInstance) {
      var node = hydrationInstance, depth = 0;
      do {
        var nextNode = node.nextSibling;
        parentInstance.removeChild(node);
        if (nextNode && 8 === nextNode.nodeType)
          if (node = nextNode.data, "/$" === node || "/&" === node) {
            if (0 === depth) {
              parentInstance.removeChild(nextNode);
              retryIfBlockedOn(hydrationInstance);
              return;
            }
            depth--;
          } else if ("$" === node || "$?" === node || "$~" === node || "$!" === node || "&" === node)
            depth++;
          else if ("html" === node)
            releaseSingletonInstance(parentInstance.ownerDocument.documentElement);
          else if ("head" === node) {
            node = parentInstance.ownerDocument.head;
            releaseSingletonInstance(node);
            for (var node$jscomp$0 = node.firstChild; node$jscomp$0; ) {
              var nextNode$jscomp$0 = node$jscomp$0.nextSibling, nodeName = node$jscomp$0.nodeName;
              node$jscomp$0[internalHoistableMarker] || "SCRIPT" === nodeName || "STYLE" === nodeName || "LINK" === nodeName && "stylesheet" === node$jscomp$0.rel.toLowerCase() || node.removeChild(node$jscomp$0);
              node$jscomp$0 = nextNode$jscomp$0;
            }
          } else
            "body" === node && releaseSingletonInstance(parentInstance.ownerDocument.body);
        node = nextNode;
      } while (node);
      retryIfBlockedOn(hydrationInstance);
    }
    function hideOrUnhideDehydratedBoundary(suspenseInstance, isHidden) {
      var node = suspenseInstance;
      suspenseInstance = 0;
      do {
        var nextNode = node.nextSibling;
        1 === node.nodeType ? isHidden ? (node._stashedDisplay = node.style.display, node.style.display = "none") : (node.style.display = node._stashedDisplay || "", "" === node.getAttribute("style") && node.removeAttribute("style")) : 3 === node.nodeType && (isHidden ? (node._stashedText = node.nodeValue, node.nodeValue = "") : node.nodeValue = node._stashedText || "");
        if (nextNode && 8 === nextNode.nodeType)
          if (node = nextNode.data, "/$" === node)
            if (0 === suspenseInstance) break;
            else suspenseInstance--;
          else
            "$" !== node && "$?" !== node && "$~" !== node && "$!" !== node || suspenseInstance++;
        node = nextNode;
      } while (node);
    }
    function clearContainerSparingly(container) {
      var nextNode = container.firstChild;
      nextNode && 10 === nextNode.nodeType && (nextNode = nextNode.nextSibling);
      for (; nextNode; ) {
        var node = nextNode;
        nextNode = nextNode.nextSibling;
        switch (node.nodeName) {
          case "HTML":
          case "HEAD":
          case "BODY":
            clearContainerSparingly(node);
            detachDeletedInstance(node);
            continue;
          case "SCRIPT":
          case "STYLE":
            continue;
          case "LINK":
            if ("stylesheet" === node.rel.toLowerCase()) continue;
        }
        container.removeChild(node);
      }
    }
    function canHydrateInstance(instance, type, props, inRootOrSingleton) {
      for (; 1 === instance.nodeType; ) {
        var anyProps = props;
        if (instance.nodeName.toLowerCase() !== type.toLowerCase()) {
          if (!inRootOrSingleton && ("INPUT" !== instance.nodeName || "hidden" !== instance.type))
            break;
        } else if (!inRootOrSingleton)
          if ("input" === type && "hidden" === instance.type) {
            var name = null == anyProps.name ? null : "" + anyProps.name;
            if ("hidden" === anyProps.type && instance.getAttribute("name") === name)
              return instance;
          } else return instance;
        else if (!instance[internalHoistableMarker])
          switch (type) {
            case "meta":
              if (!instance.hasAttribute("itemprop")) break;
              return instance;
            case "link":
              name = instance.getAttribute("rel");
              if ("stylesheet" === name && instance.hasAttribute("data-precedence"))
                break;
              else if (name !== anyProps.rel || instance.getAttribute("href") !== (null == anyProps.href || "" === anyProps.href ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (null == anyProps.title ? null : anyProps.title))
                break;
              return instance;
            case "style":
              if (instance.hasAttribute("data-precedence")) break;
              return instance;
            case "script":
              name = instance.getAttribute("src");
              if ((name !== (null == anyProps.src ? null : anyProps.src) || instance.getAttribute("type") !== (null == anyProps.type ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
                break;
              return instance;
            default:
              return instance;
          }
        instance = getNextHydratable(instance.nextSibling);
        if (null === instance) break;
      }
      return null;
    }
    function canHydrateTextInstance(instance, text, inRootOrSingleton) {
      if ("" === text) return null;
      for (; 3 !== instance.nodeType; ) {
        if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
          return null;
        instance = getNextHydratable(instance.nextSibling);
        if (null === instance) return null;
      }
      return instance;
    }
    function canHydrateHydrationBoundary(instance, inRootOrSingleton) {
      for (; 8 !== instance.nodeType; ) {
        if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
          return null;
        instance = getNextHydratable(instance.nextSibling);
        if (null === instance) return null;
      }
      return instance;
    }
    function isSuspenseInstancePending(instance) {
      return "$?" === instance.data || "$~" === instance.data;
    }
    function isSuspenseInstanceFallback(instance) {
      return "$!" === instance.data || "$?" === instance.data && "loading" !== instance.ownerDocument.readyState;
    }
    function registerSuspenseInstanceRetry(instance, callback) {
      var ownerDocument = instance.ownerDocument;
      if ("$~" === instance.data) instance._reactRetry = callback;
      else if ("$?" !== instance.data || "loading" !== ownerDocument.readyState)
        callback();
      else {
        var listener = function() {
          callback();
          ownerDocument.removeEventListener("DOMContentLoaded", listener);
        };
        ownerDocument.addEventListener("DOMContentLoaded", listener);
        instance._reactRetry = listener;
      }
    }
    function getNextHydratable(node) {
      for (; null != node; node = node.nextSibling) {
        var nodeType = node.nodeType;
        if (1 === nodeType || 3 === nodeType) break;
        if (8 === nodeType) {
          nodeType = node.data;
          if ("$" === nodeType || "$!" === nodeType || "$?" === nodeType || "$~" === nodeType || "&" === nodeType || "F!" === nodeType || "F" === nodeType)
            break;
          if ("/$" === nodeType || "/&" === nodeType) return null;
        }
      }
      return node;
    }
    var previousHydratableOnEnteringScopedSingleton = null;
    function getNextHydratableInstanceAfterHydrationBoundary(hydrationInstance) {
      hydrationInstance = hydrationInstance.nextSibling;
      for (var depth = 0; hydrationInstance; ) {
        if (8 === hydrationInstance.nodeType) {
          var data = hydrationInstance.data;
          if ("/$" === data || "/&" === data) {
            if (0 === depth)
              return getNextHydratable(hydrationInstance.nextSibling);
            depth--;
          } else
            "$" !== data && "$!" !== data && "$?" !== data && "$~" !== data && "&" !== data || depth++;
        }
        hydrationInstance = hydrationInstance.nextSibling;
      }
      return null;
    }
    function getParentHydrationBoundary(targetInstance) {
      targetInstance = targetInstance.previousSibling;
      for (var depth = 0; targetInstance; ) {
        if (8 === targetInstance.nodeType) {
          var data = targetInstance.data;
          if ("$" === data || "$!" === data || "$?" === data || "$~" === data || "&" === data) {
            if (0 === depth) return targetInstance;
            depth--;
          } else "/$" !== data && "/&" !== data || depth++;
        }
        targetInstance = targetInstance.previousSibling;
      }
      return null;
    }
    function resolveSingletonInstance(type, props, rootContainerInstance) {
      props = getOwnerDocumentFromRootContainer(rootContainerInstance);
      switch (type) {
        case "html":
          type = props.documentElement;
          if (!type) throw Error(formatProdErrorMessage(452));
          return type;
        case "head":
          type = props.head;
          if (!type) throw Error(formatProdErrorMessage(453));
          return type;
        case "body":
          type = props.body;
          if (!type) throw Error(formatProdErrorMessage(454));
          return type;
        default:
          throw Error(formatProdErrorMessage(451));
      }
    }
    function releaseSingletonInstance(instance) {
      for (var attributes = instance.attributes; attributes.length; )
        instance.removeAttributeNode(attributes[0]);
      detachDeletedInstance(instance);
    }
    var preloadPropsMap = /* @__PURE__ */ new Map();
    var preconnectsSet = /* @__PURE__ */ new Set();
    function getHoistableRoot(container) {
      return "function" === typeof container.getRootNode ? container.getRootNode() : 9 === container.nodeType ? container : container.ownerDocument;
    }
    var previousDispatcher = ReactDOMSharedInternals.d;
    ReactDOMSharedInternals.d = {
      f: flushSyncWork,
      r: requestFormReset,
      D: prefetchDNS,
      C: preconnect,
      L: preload,
      m: preloadModule,
      X: preinitScript,
      S: preinitStyle,
      M: preinitModuleScript
    };
    function flushSyncWork() {
      var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
      return previousWasRendering || wasRendering;
    }
    function requestFormReset(form) {
      var formInst = getInstanceFromNode(form);
      null !== formInst && 5 === formInst.tag && "form" === formInst.type ? requestFormReset$1(formInst) : previousDispatcher.r(form);
    }
    var globalDocument = "undefined" === typeof document ? null : document;
    function preconnectAs(rel, href, crossOrigin) {
      var ownerDocument = globalDocument;
      if (ownerDocument && "string" === typeof href && href) {
        var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
        limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
        "string" === typeof crossOrigin && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
        preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, null === ownerDocument.querySelector(limitedEscapedHref) && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
      }
    }
    function prefetchDNS(href) {
      previousDispatcher.D(href);
      preconnectAs("dns-prefetch", href, null);
    }
    function preconnect(href, crossOrigin) {
      previousDispatcher.C(href, crossOrigin);
      preconnectAs("preconnect", href, crossOrigin);
    }
    function preload(href, as, options2) {
      previousDispatcher.L(href, as, options2);
      var ownerDocument = globalDocument;
      if (ownerDocument && href && as) {
        var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
        "image" === as ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(
          options2.imageSrcSet
        ) + '"]', "string" === typeof options2.imageSizes && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(
          options2.imageSizes
        ) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
        var key = preloadSelector;
        switch (as) {
          case "style":
            key = getStyleKey(href);
            break;
          case "script":
            key = getScriptKey(href);
        }
        preloadPropsMap.has(key) || (href = assign(
          {
            rel: "preload",
            href: "image" === as && options2 && options2.imageSrcSet ? void 0 : href,
            as
          },
          options2
        ), preloadPropsMap.set(key, href), null !== ownerDocument.querySelector(preloadSelector) || "style" === as && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || "script" === as && ownerDocument.querySelector(getScriptSelectorFromKey(key)) || (as = ownerDocument.createElement("link"), setInitialProperties(as, "link", href), markNodeAsHoistable(as), ownerDocument.head.appendChild(as)));
      }
    }
    function preloadModule(href, options2) {
      previousDispatcher.m(href, options2);
      var ownerDocument = globalDocument;
      if (ownerDocument && href) {
        var as = options2 && "string" === typeof options2.as ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
        switch (as) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            key = getScriptKey(href);
        }
        if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), null === ownerDocument.querySelector(preloadSelector))) {
          switch (as) {
            case "audioworklet":
            case "paintworklet":
            case "serviceworker":
            case "sharedworker":
            case "worker":
            case "script":
              if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
                return;
          }
          as = ownerDocument.createElement("link");
          setInitialProperties(as, "link", href);
          markNodeAsHoistable(as);
          ownerDocument.head.appendChild(as);
        }
      }
    }
    function preinitStyle(href, precedence, options2) {
      previousDispatcher.S(href, precedence, options2);
      var ownerDocument = globalDocument;
      if (ownerDocument && href) {
        var styles = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
        precedence = precedence || "default";
        var resource = styles.get(key);
        if (!resource) {
          var state = { loading: 0, preload: null };
          if (resource = ownerDocument.querySelector(
            getStylesheetSelectorFromKey(key)
          ))
            state.loading = 5;
          else {
            href = assign(
              { rel: "stylesheet", href, "data-precedence": precedence },
              options2
            );
            (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
            var link = resource = ownerDocument.createElement("link");
            markNodeAsHoistable(link);
            setInitialProperties(link, "link", href);
            link._p = new Promise(function(resolve, reject) {
              link.onload = resolve;
              link.onerror = reject;
            });
            link.addEventListener("load", function() {
              state.loading |= 1;
            });
            link.addEventListener("error", function() {
              state.loading |= 2;
            });
            state.loading |= 4;
            insertStylesheet(resource, precedence, ownerDocument);
          }
          resource = {
            type: "stylesheet",
            instance: resource,
            count: 1,
            state
          };
          styles.set(key, resource);
        }
      }
    }
    function preinitScript(src, options2) {
      previousDispatcher.X(src, options2);
      var ownerDocument = globalDocument;
      if (ownerDocument && src) {
        var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
        resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
          type: "script",
          instance: resource,
          count: 1,
          state: null
        }, scripts.set(key, resource));
      }
    }
    function preinitModuleScript(src, options2) {
      previousDispatcher.M(src, options2);
      var ownerDocument = globalDocument;
      if (ownerDocument && src) {
        var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
        resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
          type: "script",
          instance: resource,
          count: 1,
          state: null
        }, scripts.set(key, resource));
      }
    }
    function getResource(type, currentProps, pendingProps, currentResource) {
      var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
      if (!JSCompiler_inline_result) throw Error(formatProdErrorMessage(446));
      switch (type) {
        case "meta":
        case "title":
          return null;
        case "style":
          return "string" === typeof pendingProps.precedence && "string" === typeof pendingProps.href ? (currentProps = getStyleKey(pendingProps.href), pendingProps = getResourcesFromRoot(
            JSCompiler_inline_result
          ).hoistableStyles, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
            type: "style",
            instance: null,
            count: 0,
            state: null
          }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
        case "link":
          if ("stylesheet" === pendingProps.rel && "string" === typeof pendingProps.href && "string" === typeof pendingProps.precedence) {
            type = getStyleKey(pendingProps.href);
            var styles$243 = getResourcesFromRoot(
              JSCompiler_inline_result
            ).hoistableStyles, resource$244 = styles$243.get(type);
            resource$244 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$244 = {
              type: "stylesheet",
              instance: null,
              count: 0,
              state: { loading: 0, preload: null }
            }, styles$243.set(type, resource$244), (styles$243 = JSCompiler_inline_result.querySelector(
              getStylesheetSelectorFromKey(type)
            )) && !styles$243._p && (resource$244.instance = styles$243, resource$244.state.loading = 5), preloadPropsMap.has(type) || (pendingProps = {
              rel: "preload",
              as: "style",
              href: pendingProps.href,
              crossOrigin: pendingProps.crossOrigin,
              integrity: pendingProps.integrity,
              media: pendingProps.media,
              hrefLang: pendingProps.hrefLang,
              referrerPolicy: pendingProps.referrerPolicy
            }, preloadPropsMap.set(type, pendingProps), styles$243 || preloadStylesheet(
              JSCompiler_inline_result,
              type,
              pendingProps,
              resource$244.state
            )));
            if (currentProps && null === currentResource)
              throw Error(formatProdErrorMessage(528, ""));
            return resource$244;
          }
          if (currentProps && null !== currentResource)
            throw Error(formatProdErrorMessage(529, ""));
          return null;
        case "script":
          return currentProps = pendingProps.async, pendingProps = pendingProps.src, "string" === typeof pendingProps && currentProps && "function" !== typeof currentProps && "symbol" !== typeof currentProps ? (currentProps = getScriptKey(pendingProps), pendingProps = getResourcesFromRoot(
            JSCompiler_inline_result
          ).hoistableScripts, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
            type: "script",
            instance: null,
            count: 0,
            state: null
          }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
        default:
          throw Error(formatProdErrorMessage(444, type));
      }
    }
    function getStyleKey(href) {
      return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
    }
    function getStylesheetSelectorFromKey(key) {
      return 'link[rel="stylesheet"][' + key + "]";
    }
    function stylesheetPropsFromRawProps(rawProps) {
      return assign({}, rawProps, {
        "data-precedence": rawProps.precedence,
        precedence: null
      });
    }
    function preloadStylesheet(ownerDocument, key, preloadProps, state) {
      ownerDocument.querySelector('link[rel="preload"][as="style"][' + key + "]") ? state.loading = 1 : (key = ownerDocument.createElement("link"), state.preload = key, key.addEventListener("load", function() {
        return state.loading |= 1;
      }), key.addEventListener("error", function() {
        return state.loading |= 2;
      }), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key));
    }
    function getScriptKey(src) {
      return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
    }
    function getScriptSelectorFromKey(key) {
      return "script[async]" + key;
    }
    function acquireResource(hoistableRoot, resource, props) {
      resource.count++;
      if (null === resource.instance)
        switch (resource.type) {
          case "style":
            var instance = hoistableRoot.querySelector(
              'style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]'
            );
            if (instance)
              return resource.instance = instance, markNodeAsHoistable(instance), instance;
            var styleProps = assign({}, props, {
              "data-href": props.href,
              "data-precedence": props.precedence,
              href: null,
              precedence: null
            });
            instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement(
              "style"
            );
            markNodeAsHoistable(instance);
            setInitialProperties(instance, "style", styleProps);
            insertStylesheet(instance, props.precedence, hoistableRoot);
            return resource.instance = instance;
          case "stylesheet":
            styleProps = getStyleKey(props.href);
            var instance$249 = hoistableRoot.querySelector(
              getStylesheetSelectorFromKey(styleProps)
            );
            if (instance$249)
              return resource.state.loading |= 4, resource.instance = instance$249, markNodeAsHoistable(instance$249), instance$249;
            instance = stylesheetPropsFromRawProps(props);
            (styleProps = preloadPropsMap.get(styleProps)) && adoptPreloadPropsForStylesheet(instance, styleProps);
            instance$249 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
            markNodeAsHoistable(instance$249);
            var linkInstance = instance$249;
            linkInstance._p = new Promise(function(resolve, reject) {
              linkInstance.onload = resolve;
              linkInstance.onerror = reject;
            });
            setInitialProperties(instance$249, "link", instance);
            resource.state.loading |= 4;
            insertStylesheet(instance$249, props.precedence, hoistableRoot);
            return resource.instance = instance$249;
          case "script":
            instance$249 = getScriptKey(props.src);
            if (styleProps = hoistableRoot.querySelector(
              getScriptSelectorFromKey(instance$249)
            ))
              return resource.instance = styleProps, markNodeAsHoistable(styleProps), styleProps;
            instance = props;
            if (styleProps = preloadPropsMap.get(instance$249))
              instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps);
            hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
            styleProps = hoistableRoot.createElement("script");
            markNodeAsHoistable(styleProps);
            setInitialProperties(styleProps, "link", instance);
            hoistableRoot.head.appendChild(styleProps);
            return resource.instance = styleProps;
          case "void":
            return null;
          default:
            throw Error(formatProdErrorMessage(443, resource.type));
        }
      else
        "stylesheet" === resource.type && 0 === (resource.state.loading & 4) && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
      return resource.instance;
    }
    function insertStylesheet(instance, precedence, root2) {
      for (var nodes = root2.querySelectorAll(
        'link[rel="stylesheet"][data-precedence],style[data-precedence]'
      ), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.dataset.precedence === precedence) prior = node;
        else if (prior !== last) break;
      }
      prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = 9 === root2.nodeType ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
    }
    function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
      null == stylesheetProps.crossOrigin && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
      null == stylesheetProps.referrerPolicy && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
      null == stylesheetProps.title && (stylesheetProps.title = preloadProps.title);
    }
    function adoptPreloadPropsForScript(scriptProps, preloadProps) {
      null == scriptProps.crossOrigin && (scriptProps.crossOrigin = preloadProps.crossOrigin);
      null == scriptProps.referrerPolicy && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
      null == scriptProps.integrity && (scriptProps.integrity = preloadProps.integrity);
    }
    var tagCaches = null;
    function getHydratableHoistableCache(type, keyAttribute, ownerDocument) {
      if (null === tagCaches) {
        var cache = /* @__PURE__ */ new Map();
        var caches = tagCaches = /* @__PURE__ */ new Map();
        caches.set(ownerDocument, cache);
      } else
        caches = tagCaches, cache = caches.get(ownerDocument), cache || (cache = /* @__PURE__ */ new Map(), caches.set(ownerDocument, cache));
      if (cache.has(type)) return cache;
      cache.set(type, null);
      ownerDocument = ownerDocument.getElementsByTagName(type);
      for (caches = 0; caches < ownerDocument.length; caches++) {
        var node = ownerDocument[caches];
        if (!(node[internalHoistableMarker] || node[internalInstanceKey] || "link" === type && "stylesheet" === node.getAttribute("rel")) && "http://www.w3.org/2000/svg" !== node.namespaceURI) {
          var nodeKey = node.getAttribute(keyAttribute) || "";
          nodeKey = type + nodeKey;
          var existing = cache.get(nodeKey);
          existing ? existing.push(node) : cache.set(nodeKey, [node]);
        }
      }
      return cache;
    }
    function mountHoistable(hoistableRoot, type, instance) {
      hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
      hoistableRoot.head.insertBefore(
        instance,
        "title" === type ? hoistableRoot.querySelector("head > title") : null
      );
    }
    function isHostHoistableType(type, props, hostContext) {
      if (1 === hostContext || null != props.itemProp) return false;
      switch (type) {
        case "meta":
        case "title":
          return true;
        case "style":
          if ("string" !== typeof props.precedence || "string" !== typeof props.href || "" === props.href)
            break;
          return true;
        case "link":
          if ("string" !== typeof props.rel || "string" !== typeof props.href || "" === props.href || props.onLoad || props.onError)
            break;
          switch (props.rel) {
            case "stylesheet":
              return type = props.disabled, "string" === typeof props.precedence && null == type;
            default:
              return true;
          }
        case "script":
          if (props.async && "function" !== typeof props.async && "symbol" !== typeof props.async && !props.onLoad && !props.onError && props.src && "string" === typeof props.src)
            return true;
      }
      return false;
    }
    function preloadResource(resource) {
      return "stylesheet" === resource.type && 0 === (resource.state.loading & 3) ? false : true;
    }
    function suspendResource(state, hoistableRoot, resource, props) {
      if ("stylesheet" === resource.type && ("string" !== typeof props.media || false !== matchMedia(props.media).matches) && 0 === (resource.state.loading & 4)) {
        if (null === resource.instance) {
          var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(
            getStylesheetSelectorFromKey(key)
          );
          if (instance) {
            hoistableRoot = instance._p;
            null !== hoistableRoot && "object" === typeof hoistableRoot && "function" === typeof hoistableRoot.then && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
            resource.state.loading |= 4;
            resource.instance = instance;
            markNodeAsHoistable(instance);
            return;
          }
          instance = hoistableRoot.ownerDocument || hoistableRoot;
          props = stylesheetPropsFromRawProps(props);
          (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
          instance = instance.createElement("link");
          markNodeAsHoistable(instance);
          var linkInstance = instance;
          linkInstance._p = new Promise(function(resolve, reject) {
            linkInstance.onload = resolve;
            linkInstance.onerror = reject;
          });
          setInitialProperties(instance, "link", props);
          resource.instance = instance;
        }
        null === state.stylesheets && (state.stylesheets = /* @__PURE__ */ new Map());
        state.stylesheets.set(resource, hoistableRoot);
        (hoistableRoot = resource.state.preload) && 0 === (resource.state.loading & 3) && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
      }
    }
    var estimatedBytesWithinLimit = 0;
    function waitForCommitToBeReady(state, timeoutOffset) {
      state.stylesheets && 0 === state.count && insertSuspendedStylesheets(state, state.stylesheets);
      return 0 < state.count || 0 < state.imgCount ? function(commit) {
        var stylesheetTimer = setTimeout(function() {
          state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
          if (state.unsuspend) {
            var unsuspend = state.unsuspend;
            state.unsuspend = null;
            unsuspend();
          }
        }, 6e4 + timeoutOffset);
        0 < state.imgBytes && 0 === estimatedBytesWithinLimit && (estimatedBytesWithinLimit = 62500 * estimateBandwidth());
        var imgTimer = setTimeout(
          function() {
            state.waitingForImages = false;
            if (0 === state.count && (state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets), state.unsuspend)) {
              var unsuspend = state.unsuspend;
              state.unsuspend = null;
              unsuspend();
            }
          },
          (state.imgBytes > estimatedBytesWithinLimit ? 50 : 800) + timeoutOffset
        );
        state.unsuspend = commit;
        return function() {
          state.unsuspend = null;
          clearTimeout(stylesheetTimer);
          clearTimeout(imgTimer);
        };
      } : null;
    }
    function onUnsuspend() {
      this.count--;
      if (0 === this.count && (0 === this.imgCount || !this.waitingForImages)) {
        if (this.stylesheets) insertSuspendedStylesheets(this, this.stylesheets);
        else if (this.unsuspend) {
          var unsuspend = this.unsuspend;
          this.unsuspend = null;
          unsuspend();
        }
      }
    }
    var precedencesByRoot = null;
    function insertSuspendedStylesheets(state, resources) {
      state.stylesheets = null;
      null !== state.unsuspend && (state.count++, precedencesByRoot = /* @__PURE__ */ new Map(), resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
    }
    function insertStylesheetIntoRoot(root2, resource) {
      if (!(resource.state.loading & 4)) {
        var precedences = precedencesByRoot.get(root2);
        if (precedences) var last = precedences.get(null);
        else {
          precedences = /* @__PURE__ */ new Map();
          precedencesByRoot.set(root2, precedences);
          for (var nodes = root2.querySelectorAll(
            "link[data-precedence],style[data-precedence]"
          ), i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if ("LINK" === node.nodeName || "not all" !== node.getAttribute("media"))
              precedences.set(node.dataset.precedence, node), last = node;
          }
          last && precedences.set(null, last);
        }
        nodes = resource.instance;
        node = nodes.getAttribute("data-precedence");
        i = precedences.get(node) || last;
        i === last && precedences.set(null, nodes);
        precedences.set(node, nodes);
        this.count++;
        last = onUnsuspend.bind(this);
        nodes.addEventListener("load", last);
        nodes.addEventListener("error", last);
        i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = 9 === root2.nodeType ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
        resource.state.loading |= 4;
      }
    }
    var HostTransitionContext = {
      $$typeof: REACT_CONTEXT_TYPE,
      Provider: null,
      Consumer: null,
      _currentValue: sharedNotPendingObject,
      _currentValue2: sharedNotPendingObject,
      _threadCount: 0
    };
    function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator, formState) {
      this.tag = 1;
      this.containerInfo = containerInfo;
      this.pingCache = this.current = this.pendingChildren = null;
      this.timeoutHandle = -1;
      this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
      this.callbackPriority = 0;
      this.expirationTimes = createLaneMap(-1);
      this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
      this.entanglements = createLaneMap(0);
      this.hiddenUpdates = createLaneMap(null);
      this.identifierPrefix = identifierPrefix;
      this.onUncaughtError = onUncaughtError;
      this.onCaughtError = onCaughtError;
      this.onRecoverableError = onRecoverableError;
      this.pooledCache = null;
      this.pooledCacheLanes = 0;
      this.formState = formState;
      this.incompleteTransitions = /* @__PURE__ */ new Map();
    }
    function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, formState, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator) {
      containerInfo = new FiberRootNode(
        containerInfo,
        tag,
        hydrate,
        identifierPrefix,
        onUncaughtError,
        onCaughtError,
        onRecoverableError,
        onDefaultTransitionIndicator,
        formState
      );
      tag = 1;
      true === isStrictMode && (tag |= 24);
      isStrictMode = createFiberImplClass(3, null, null, tag);
      containerInfo.current = isStrictMode;
      isStrictMode.stateNode = containerInfo;
      tag = createCache();
      tag.refCount++;
      containerInfo.pooledCache = tag;
      tag.refCount++;
      isStrictMode.memoizedState = {
        element: initialChildren,
        isDehydrated: hydrate,
        cache: tag
      };
      initializeUpdateQueue(isStrictMode);
      return containerInfo;
    }
    function getContextForSubtree(parentComponent) {
      if (!parentComponent) return emptyContextObject;
      parentComponent = emptyContextObject;
      return parentComponent;
    }
    function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
      parentComponent = getContextForSubtree(parentComponent);
      null === container.context ? container.context = parentComponent : container.pendingContext = parentComponent;
      container = createUpdate(lane);
      container.payload = { element };
      callback = void 0 === callback ? null : callback;
      null !== callback && (container.callback = callback);
      element = enqueueUpdate(rootFiber, container, lane);
      null !== element && (scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
    }
    function markRetryLaneImpl(fiber, retryLane) {
      fiber = fiber.memoizedState;
      if (null !== fiber && null !== fiber.dehydrated) {
        var a = fiber.retryLane;
        fiber.retryLane = 0 !== a && a < retryLane ? a : retryLane;
      }
    }
    function markRetryLaneIfNotHydrated(fiber, retryLane) {
      markRetryLaneImpl(fiber, retryLane);
      (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
    }
    function attemptContinuousHydration(fiber) {
      if (13 === fiber.tag || 31 === fiber.tag) {
        var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
        null !== root2 && scheduleUpdateOnFiber(root2, fiber, 67108864);
        markRetryLaneIfNotHydrated(fiber, 67108864);
      }
    }
    function attemptHydrationAtCurrentPriority(fiber) {
      if (13 === fiber.tag || 31 === fiber.tag) {
        var lane = requestUpdateLane();
        lane = getBumpedLaneForHydrationByLane(lane);
        var root2 = enqueueConcurrentRenderForLane(fiber, lane);
        null !== root2 && scheduleUpdateOnFiber(root2, fiber, lane);
        markRetryLaneIfNotHydrated(fiber, lane);
      }
    }
    var _enabled = true;
    function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
      var prevTransition = ReactSharedInternals.T;
      ReactSharedInternals.T = null;
      var previousPriority = ReactDOMSharedInternals.p;
      try {
        ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
      } finally {
        ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
      }
    }
    function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
      var prevTransition = ReactSharedInternals.T;
      ReactSharedInternals.T = null;
      var previousPriority = ReactDOMSharedInternals.p;
      try {
        ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
      } finally {
        ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
      }
    }
    function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
      if (_enabled) {
        var blockedOn = findInstanceBlockingEvent(nativeEvent);
        if (null === blockedOn)
          dispatchEventForPluginEventSystem(
            domEventName,
            eventSystemFlags,
            nativeEvent,
            return_targetInst,
            targetContainer
          ), clearIfContinuousEvent(domEventName, nativeEvent);
        else if (queueIfContinuousEvent(
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent
        ))
          nativeEvent.stopPropagation();
        else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
          for (; null !== blockedOn; ) {
            var fiber = getInstanceFromNode(blockedOn);
            if (null !== fiber)
              switch (fiber.tag) {
                case 3:
                  fiber = fiber.stateNode;
                  if (fiber.current.memoizedState.isDehydrated) {
                    var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                    if (0 !== lanes) {
                      var root2 = fiber;
                      root2.pendingLanes |= 2;
                      for (root2.entangledLanes |= 2; lanes; ) {
                        var lane = 1 << 31 - clz32(lanes);
                        root2.entanglements[1] |= lane;
                        lanes &= ~lane;
                      }
                      ensureRootIsScheduled(fiber);
                      0 === (executionContext & 6) && (workInProgressRootRenderTargetTime = now() + 500, flushSyncWorkAcrossRoots_impl(0, false));
                    }
                  }
                  break;
                case 31:
                case 13:
                  root2 = enqueueConcurrentRenderForLane(fiber, 2), null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
              }
            fiber = findInstanceBlockingEvent(nativeEvent);
            null === fiber && dispatchEventForPluginEventSystem(
              domEventName,
              eventSystemFlags,
              nativeEvent,
              return_targetInst,
              targetContainer
            );
            if (fiber === blockedOn) break;
            blockedOn = fiber;
          }
          null !== blockedOn && nativeEvent.stopPropagation();
        } else
          dispatchEventForPluginEventSystem(
            domEventName,
            eventSystemFlags,
            nativeEvent,
            null,
            targetContainer
          );
      }
    }
    function findInstanceBlockingEvent(nativeEvent) {
      nativeEvent = getEventTarget(nativeEvent);
      return findInstanceBlockingTarget(nativeEvent);
    }
    var return_targetInst = null;
    function findInstanceBlockingTarget(targetNode) {
      return_targetInst = null;
      targetNode = getClosestInstanceFromNode(targetNode);
      if (null !== targetNode) {
        var nearestMounted = getNearestMountedFiber(targetNode);
        if (null === nearestMounted) targetNode = null;
        else {
          var tag = nearestMounted.tag;
          if (13 === tag) {
            targetNode = getSuspenseInstanceFromFiber(nearestMounted);
            if (null !== targetNode) return targetNode;
            targetNode = null;
          } else if (31 === tag) {
            targetNode = getActivityInstanceFromFiber(nearestMounted);
            if (null !== targetNode) return targetNode;
            targetNode = null;
          } else if (3 === tag) {
            if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
              return 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
            targetNode = null;
          } else nearestMounted !== targetNode && (targetNode = null);
        }
      }
      return_targetInst = targetNode;
      return null;
    }
    function getEventPriority(domEventName) {
      switch (domEventName) {
        case "beforetoggle":
        case "cancel":
        case "click":
        case "close":
        case "contextmenu":
        case "copy":
        case "cut":
        case "auxclick":
        case "dblclick":
        case "dragend":
        case "dragstart":
        case "drop":
        case "focusin":
        case "focusout":
        case "input":
        case "invalid":
        case "keydown":
        case "keypress":
        case "keyup":
        case "mousedown":
        case "mouseup":
        case "paste":
        case "pause":
        case "play":
        case "pointercancel":
        case "pointerdown":
        case "pointerup":
        case "ratechange":
        case "reset":
        case "resize":
        case "seeked":
        case "submit":
        case "toggle":
        case "touchcancel":
        case "touchend":
        case "touchstart":
        case "volumechange":
        case "change":
        case "selectionchange":
        case "textInput":
        case "compositionstart":
        case "compositionend":
        case "compositionupdate":
        case "beforeblur":
        case "afterblur":
        case "beforeinput":
        case "blur":
        case "fullscreenchange":
        case "focus":
        case "hashchange":
        case "popstate":
        case "select":
        case "selectstart":
          return 2;
        case "drag":
        case "dragenter":
        case "dragexit":
        case "dragleave":
        case "dragover":
        case "mousemove":
        case "mouseout":
        case "mouseover":
        case "pointermove":
        case "pointerout":
        case "pointerover":
        case "scroll":
        case "touchmove":
        case "wheel":
        case "mouseenter":
        case "mouseleave":
        case "pointerenter":
        case "pointerleave":
          return 8;
        case "message":
          switch (getCurrentPriorityLevel()) {
            case ImmediatePriority:
              return 2;
            case UserBlockingPriority:
              return 8;
            case NormalPriority$1:
            case LowPriority:
              return 32;
            case IdlePriority:
              return 268435456;
            default:
              return 32;
          }
        default:
          return 32;
      }
    }
    var hasScheduledReplayAttempt = false;
    var queuedFocus = null;
    var queuedDrag = null;
    var queuedMouse = null;
    var queuedPointers = /* @__PURE__ */ new Map();
    var queuedPointerCaptures = /* @__PURE__ */ new Map();
    var queuedExplicitHydrationTargets = [];
    var discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
      " "
    );
    function clearIfContinuousEvent(domEventName, nativeEvent) {
      switch (domEventName) {
        case "focusin":
        case "focusout":
          queuedFocus = null;
          break;
        case "dragenter":
        case "dragleave":
          queuedDrag = null;
          break;
        case "mouseover":
        case "mouseout":
          queuedMouse = null;
          break;
        case "pointerover":
        case "pointerout":
          queuedPointers.delete(nativeEvent.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          queuedPointerCaptures.delete(nativeEvent.pointerId);
      }
    }
    function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
      if (null === existingQueuedEvent || existingQueuedEvent.nativeEvent !== nativeEvent)
        return existingQueuedEvent = {
          blockedOn,
          domEventName,
          eventSystemFlags,
          nativeEvent,
          targetContainers: [targetContainer]
        }, null !== blockedOn && (blockedOn = getInstanceFromNode(blockedOn), null !== blockedOn && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
      existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
      blockedOn = existingQueuedEvent.targetContainers;
      null !== targetContainer && -1 === blockedOn.indexOf(targetContainer) && blockedOn.push(targetContainer);
      return existingQueuedEvent;
    }
    function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
      switch (domEventName) {
        case "focusin":
          return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
            queuedFocus,
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ), true;
        case "dragenter":
          return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
            queuedDrag,
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ), true;
        case "mouseover":
          return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
            queuedMouse,
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          ), true;
        case "pointerover":
          var pointerId = nativeEvent.pointerId;
          queuedPointers.set(
            pointerId,
            accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedPointers.get(pointerId) || null,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            )
          );
          return true;
        case "gotpointercapture":
          return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(
            pointerId,
            accumulateOrCreateContinuousQueuedReplayableEvent(
              queuedPointerCaptures.get(pointerId) || null,
              blockedOn,
              domEventName,
              eventSystemFlags,
              targetContainer,
              nativeEvent
            )
          ), true;
      }
      return false;
    }
    function attemptExplicitHydrationTarget(queuedTarget) {
      var targetInst = getClosestInstanceFromNode(queuedTarget.target);
      if (null !== targetInst) {
        var nearestMounted = getNearestMountedFiber(targetInst);
        if (null !== nearestMounted) {
          if (targetInst = nearestMounted.tag, 13 === targetInst) {
            if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), null !== targetInst) {
              queuedTarget.blockedOn = targetInst;
              runWithPriority(queuedTarget.priority, function() {
                attemptHydrationAtCurrentPriority(nearestMounted);
              });
              return;
            }
          } else if (31 === targetInst) {
            if (targetInst = getActivityInstanceFromFiber(nearestMounted), null !== targetInst) {
              queuedTarget.blockedOn = targetInst;
              runWithPriority(queuedTarget.priority, function() {
                attemptHydrationAtCurrentPriority(nearestMounted);
              });
              return;
            }
          } else if (3 === targetInst && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
            queuedTarget.blockedOn = 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
            return;
          }
        }
      }
      queuedTarget.blockedOn = null;
    }
    function attemptReplayContinuousQueuedEvent(queuedEvent) {
      if (null !== queuedEvent.blockedOn) return false;
      for (var targetContainers = queuedEvent.targetContainers; 0 < targetContainers.length; ) {
        var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
        if (null === nextBlockedOn) {
          nextBlockedOn = queuedEvent.nativeEvent;
          var nativeEventClone = new nextBlockedOn.constructor(
            nextBlockedOn.type,
            nextBlockedOn
          );
          currentReplayingEvent = nativeEventClone;
          nextBlockedOn.target.dispatchEvent(nativeEventClone);
          currentReplayingEvent = null;
        } else
          return targetContainers = getInstanceFromNode(nextBlockedOn), null !== targetContainers && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
        targetContainers.shift();
      }
      return true;
    }
    function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
      attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
    }
    function replayUnblockedEvents() {
      hasScheduledReplayAttempt = false;
      null !== queuedFocus && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
      null !== queuedDrag && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
      null !== queuedMouse && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
      queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
      queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
    }
    function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
      queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(
        Scheduler.unstable_NormalPriority,
        replayUnblockedEvents
      )));
    }
    var lastScheduledReplayQueue = null;
    function scheduleReplayQueueIfNeeded(formReplayingQueue) {
      lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(
        Scheduler.unstable_NormalPriority,
        function() {
          lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
          for (var i = 0; i < formReplayingQueue.length; i += 3) {
            var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
            if ("function" !== typeof submitterOrAction)
              if (null === findInstanceBlockingTarget(submitterOrAction || form))
                continue;
              else break;
            var formInst = getInstanceFromNode(form);
            null !== formInst && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(
              formInst,
              {
                pending: true,
                data: formData,
                method: form.method,
                action: submitterOrAction
              },
              submitterOrAction,
              formData
            ));
          }
        }
      ));
    }
    function retryIfBlockedOn(unblocked) {
      function unblock(queuedEvent) {
        return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
      }
      null !== queuedFocus && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
      null !== queuedDrag && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
      null !== queuedMouse && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
      queuedPointers.forEach(unblock);
      queuedPointerCaptures.forEach(unblock);
      for (var i = 0; i < queuedExplicitHydrationTargets.length; i++) {
        var queuedTarget = queuedExplicitHydrationTargets[i];
        queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
      }
      for (; 0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], null === i.blockedOn); )
        attemptExplicitHydrationTarget(i), null === i.blockedOn && queuedExplicitHydrationTargets.shift();
      i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
      if (null != i)
        for (queuedTarget = 0; queuedTarget < i.length; queuedTarget += 3) {
          var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
          if ("function" === typeof submitterOrAction)
            formProps || scheduleReplayQueueIfNeeded(i);
          else if (formProps) {
            var action = null;
            if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
              if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
                action = formProps.formAction;
              else {
                if (null !== findInstanceBlockingTarget(form)) continue;
              }
            else action = formProps.action;
            "function" === typeof action ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
            scheduleReplayQueueIfNeeded(i);
          }
        }
    }
    function defaultOnDefaultTransitionIndicator() {
      function handleNavigate(event) {
        event.canIntercept && "react-transition" === event.info && event.intercept({
          handler: function() {
            return new Promise(function(resolve) {
              return pendingResolve = resolve;
            });
          },
          focusReset: "manual",
          scroll: "manual"
        });
      }
      function handleNavigateComplete() {
        null !== pendingResolve && (pendingResolve(), pendingResolve = null);
        isCancelled || setTimeout(startFakeNavigation, 20);
      }
      function startFakeNavigation() {
        if (!isCancelled && !navigation.transition) {
          var currentEntry = navigation.currentEntry;
          currentEntry && null != currentEntry.url && navigation.navigate(currentEntry.url, {
            state: currentEntry.getState(),
            info: "react-transition",
            history: "replace"
          });
        }
      }
      if ("object" === typeof navigation) {
        var isCancelled = false, pendingResolve = null;
        navigation.addEventListener("navigate", handleNavigate);
        navigation.addEventListener("navigatesuccess", handleNavigateComplete);
        navigation.addEventListener("navigateerror", handleNavigateComplete);
        setTimeout(startFakeNavigation, 100);
        return function() {
          isCancelled = true;
          navigation.removeEventListener("navigate", handleNavigate);
          navigation.removeEventListener("navigatesuccess", handleNavigateComplete);
          navigation.removeEventListener("navigateerror", handleNavigateComplete);
          null !== pendingResolve && (pendingResolve(), pendingResolve = null);
        };
      }
    }
    function ReactDOMRoot(internalRoot) {
      this._internalRoot = internalRoot;
    }
    ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
      var root2 = this._internalRoot;
      if (null === root2) throw Error(formatProdErrorMessage(409));
      var current2 = root2.current, lane = requestUpdateLane();
      updateContainerImpl(current2, lane, children, root2, null, null);
    };
    ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
      var root2 = this._internalRoot;
      if (null !== root2) {
        this._internalRoot = null;
        var container = root2.containerInfo;
        updateContainerImpl(root2.current, 2, null, root2, null, null);
        flushSyncWork$1();
        container[internalContainerInstanceKey] = null;
      }
    };
    function ReactDOMHydrationRoot(internalRoot) {
      this._internalRoot = internalRoot;
    }
    ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
      if (target) {
        var updatePriority = resolveUpdatePriority();
        target = { blockedOn: null, target, priority: updatePriority };
        for (var i = 0; i < queuedExplicitHydrationTargets.length && 0 !== updatePriority && updatePriority < queuedExplicitHydrationTargets[i].priority; i++) ;
        queuedExplicitHydrationTargets.splice(i, 0, target);
        0 === i && attemptExplicitHydrationTarget(target);
      }
    };
    var isomorphicReactPackageVersion$jscomp$inline_1840 = React.version;
    if ("19.2.7" !== isomorphicReactPackageVersion$jscomp$inline_1840)
      throw Error(
        formatProdErrorMessage(
          527,
          isomorphicReactPackageVersion$jscomp$inline_1840,
          "19.2.7"
        )
      );
    ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
      var fiber = componentOrElement._reactInternals;
      if (void 0 === fiber) {
        if ("function" === typeof componentOrElement.render)
          throw Error(formatProdErrorMessage(188));
        componentOrElement = Object.keys(componentOrElement).join(",");
        throw Error(formatProdErrorMessage(268, componentOrElement));
      }
      componentOrElement = findCurrentFiberUsingSlowPath(fiber);
      componentOrElement = null !== componentOrElement ? findCurrentHostFiberImpl(componentOrElement) : null;
      componentOrElement = null === componentOrElement ? null : componentOrElement.stateNode;
      return componentOrElement;
    };
    var internals$jscomp$inline_2347 = {
      bundleType: 0,
      version: "19.2.7",
      rendererPackageName: "react-dom",
      currentDispatcherRef: ReactSharedInternals,
      reconcilerVersion: "19.2.7"
    };
    if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
      hook$jscomp$inline_2348 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook$jscomp$inline_2348.isDisabled && hook$jscomp$inline_2348.supportsFiber)
        try {
          rendererID = hook$jscomp$inline_2348.inject(
            internals$jscomp$inline_2347
          ), injectedHook = hook$jscomp$inline_2348;
        } catch (err) {
        }
    }
    var hook$jscomp$inline_2348;
    exports.createRoot = function(container, options2) {
      if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
      var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError;
      null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError));
      options2 = createFiberRoot(
        container,
        1,
        false,
        null,
        null,
        isStrictMode,
        identifierPrefix,
        null,
        onUncaughtError,
        onCaughtError,
        onRecoverableError,
        defaultOnDefaultTransitionIndicator
      );
      container[internalContainerInstanceKey] = options2.current;
      listenToAllSupportedEvents(container);
      return new ReactDOMRoot(options2);
    };
    exports.hydrateRoot = function(container, initialChildren, options2) {
      if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
      var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, formState = null;
      null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.formState && (formState = options2.formState));
      initialChildren = createFiberRoot(
        container,
        1,
        true,
        initialChildren,
        null != options2 ? options2 : null,
        isStrictMode,
        identifierPrefix,
        formState,
        onUncaughtError,
        onCaughtError,
        onRecoverableError,
        defaultOnDefaultTransitionIndicator
      );
      initialChildren.context = getContextForSubtree(null);
      options2 = initialChildren.current;
      isStrictMode = requestUpdateLane();
      isStrictMode = getBumpedLaneForHydrationByLane(isStrictMode);
      identifierPrefix = createUpdate(isStrictMode);
      identifierPrefix.callback = null;
      enqueueUpdate(options2, identifierPrefix, isStrictMode);
      options2 = isStrictMode;
      initialChildren.current.lanes = options2;
      markRootUpdated$1(initialChildren, options2);
      ensureRootIsScheduled(initialChildren);
      container[internalContainerInstanceKey] = initialChildren.current;
      listenToAllSupportedEvents(container);
      return new ReactDOMHydrationRoot(initialChildren);
    };
    exports.version = "19.2.7";
  }
});

// node_modules/react-dom/client.js
var require_client = __commonJS({
  "node_modules/react-dom/client.js"(exports, module) {
    "use strict";
    function checkDCE() {
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
        return;
      }
      if (false) {
        throw new Error("^_^");
      }
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
      } catch (err) {
        console.error(err);
      }
    }
    if (true) {
      checkDCE();
      module.exports = require_react_dom_client_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
var require_use_sync_external_store_shim_production = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js"(exports) {
    "use strict";
    var React = require_react();
    function is2(x, y2) {
      return x === y2 && (0 !== x || 1 / x === 1 / y2) || x !== x && y2 !== y2;
    }
    var objectIs = "function" === typeof Object.is ? Object.is : is2;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useLayoutEffect = React.useLayoutEffect;
    var useDebugValue2 = React.useDebugValue;
    function useSyncExternalStore$2(subscribe, getSnapshot) {
      var value = getSnapshot(), _useState = useState({ inst: { value, getSnapshot } }), inst = _useState[0].inst, forceUpdate = _useState[1];
      useLayoutEffect(
        function() {
          inst.value = value;
          inst.getSnapshot = getSnapshot;
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        },
        [subscribe, value, getSnapshot]
      );
      useEffect(
        function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          return subscribe(function() {
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          });
        },
        [subscribe]
      );
      useDebugValue2(value);
      return value;
    }
    function checkIfSnapshotChanged(inst) {
      var latestGetSnapshot = inst.getSnapshot;
      inst = inst.value;
      try {
        var nextValue = latestGetSnapshot();
        return !objectIs(inst, nextValue);
      } catch (error) {
        return true;
      }
    }
    function useSyncExternalStore$1(subscribe, getSnapshot) {
      return getSnapshot();
    }
    var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
    exports.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim;
  }
});

// node_modules/use-sync-external-store/shim/index.js
var require_shim = __commonJS({
  "node_modules/use-sync-external-store/shim/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_use_sync_external_store_shim_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
var require_with_selector_production = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js"(exports) {
    "use strict";
    var React = require_react();
    var shim = require_shim();
    function is2(x, y2) {
      return x === y2 && (0 !== x || 1 / x === 1 / y2) || x !== x && y2 !== y2;
    }
    var objectIs = "function" === typeof Object.is ? Object.is : is2;
    var useSyncExternalStore = shim.useSyncExternalStore;
    var useRef = React.useRef;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useDebugValue2 = React.useDebugValue;
    exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
      var instRef = useRef(null);
      if (null === instRef.current) {
        var inst = { hasValue: false, value: null };
        instRef.current = inst;
      } else inst = instRef.current;
      instRef = useMemo(
        function() {
          function memoizedSelector(nextSnapshot) {
            if (!hasMemo) {
              hasMemo = true;
              memoizedSnapshot = nextSnapshot;
              nextSnapshot = selector(nextSnapshot);
              if (void 0 !== isEqual && inst.hasValue) {
                var currentSelection = inst.value;
                if (isEqual(currentSelection, nextSnapshot))
                  return memoizedSelection = currentSelection;
              }
              return memoizedSelection = nextSnapshot;
            }
            currentSelection = memoizedSelection;
            if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
            var nextSelection = selector(nextSnapshot);
            if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
              return memoizedSnapshot = nextSnapshot, currentSelection;
            memoizedSnapshot = nextSnapshot;
            return memoizedSelection = nextSelection;
          }
          var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
          return [
            function() {
              return memoizedSelector(getSnapshot());
            },
            null === maybeGetServerSnapshot ? void 0 : function() {
              return memoizedSelector(maybeGetServerSnapshot());
            }
          ];
        },
        [getSnapshot, getServerSnapshot, selector, isEqual]
      );
      var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
      useEffect(
        function() {
          inst.hasValue = true;
          inst.value = value;
        },
        [value]
      );
      useDebugValue2(value);
      return value;
    };
  }
});

// node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = __commonJS({
  "node_modules/use-sync-external-store/shim/with-selector.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_with_selector_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react/cjs/react-jsx-runtime.production.js
var require_react_jsx_runtime_production = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    function jsxProd(type, config, maybeKey) {
      var key = null;
      void 0 !== maybeKey && (key = "" + maybeKey);
      void 0 !== config.key && (key = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          "key" !== propName && (maybeKey[propName] = config[propName]);
      } else maybeKey = config;
      config = maybeKey.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== config ? config : null,
        props: maybeKey
      };
    }
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = jsxProd;
    exports.jsxs = jsxProd;
  }
});

// node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_jsx_runtime_production();
    } else {
      module.exports = null;
    }
  }
});

// src/plugin-entry.tsx
var import_client = __toESM(require_client(), 1);

// node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy = () => {
    if ((import.meta.env ? import.meta.env.MODE : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };
  const api = { setState, getState, getInitialState, subscribe, destroy };
  const initialState = state = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/zustand/esm/index.mjs
var import_react = __toESM(require_react(), 1);
var import_with_selector = __toESM(require_with_selector(), 1);
var { useDebugValue } = import_react.default;
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var didWarnAboutEqualityFn = false;
var identity = (arg) => arg;
function useStore(api, selector = identity, equalityFn) {
  if ((import.meta.env ? import.meta.env.MODE : void 0) !== "production" && equalityFn && !didWarnAboutEqualityFn) {
    console.warn(
      "[DEPRECATED] Use `createWithEqualityFn` instead of `create` or use `useStoreWithEqualityFn` instead of `useStore`. They can be imported from 'zustand/traditional'. https://github.com/pmndrs/zustand/discussions/1937"
    );
    didWarnAboutEqualityFn = true;
  }
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getInitialState,
    selector,
    equalityFn
  );
  useDebugValue(slice);
  return slice;
}
var createImpl = (createState) => {
  if ((import.meta.env ? import.meta.env.MODE : void 0) !== "production" && typeof createState !== "function") {
    console.warn(
      "[DEPRECATED] Passing a vanilla store will be unsupported in a future version. Instead use `import { useStore } from 'zustand'`."
    );
  }
  const api = typeof createState === "function" ? createStore(createState) : createState;
  const useBoundStore = (selector, equalityFn) => useStore(api, selector, equalityFn);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
var create = (createState) => createState ? createImpl(createState) : createImpl;

// node_modules/immer/dist/immer.mjs
var NOTHING = Symbol.for("immer-nothing");
var DRAFTABLE = Symbol.for("immer-draftable");
var DRAFT_STATE = Symbol.for("immer-state");
function die(error, ...args) {
  if (false) {
    const e = errors[error];
    const msg = isFunction(e) ? e.apply(null, args) : e;
    throw new Error(`[Immer] ${msg}`);
  }
  throw new Error(
    `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
  );
}
var O = Object;
var getPrototypeOf = O.getPrototypeOf;
var CONSTRUCTOR = "constructor";
var PROTOTYPE = "prototype";
var CONFIGURABLE = "configurable";
var ENUMERABLE = "enumerable";
var WRITABLE = "writable";
var VALUE = "value";
var isDraft = (value) => !!value && !!value[DRAFT_STATE];
function isDraftable(value) {
  if (!value)
    return false;
  return isPlainObject(value) || isArray(value) || !!value[DRAFTABLE] || !!value[CONSTRUCTOR]?.[DRAFTABLE] || isMap(value) || isSet(value);
}
var objectCtorString = O[PROTOTYPE][CONSTRUCTOR].toString();
var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
function isPlainObject(value) {
  if (!value || !isObjectish(value))
    return false;
  const proto = getPrototypeOf(value);
  if (proto === null || proto === O[PROTOTYPE])
    return true;
  const Ctor = O.hasOwnProperty.call(proto, CONSTRUCTOR) && proto[CONSTRUCTOR];
  if (Ctor === Object)
    return true;
  if (!isFunction(Ctor))
    return false;
  let ctorString = cachedCtorStrings.get(Ctor);
  if (ctorString === void 0) {
    ctorString = Function.toString.call(Ctor);
    cachedCtorStrings.set(Ctor, ctorString);
  }
  return ctorString === objectCtorString;
}
function each(obj, iter, strict = true) {
  if (getArchtype(obj) === 0) {
    const keys = strict ? Reflect.ownKeys(obj) : O.keys(obj);
    keys.forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry, index) => iter(index, entry, obj));
  }
}
function getArchtype(thing) {
  const state = thing[DRAFT_STATE];
  return state ? state.type_ : isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
var has = (thing, prop, type = getArchtype(thing)) => type === 2 ? thing.has(prop) : O[PROTOTYPE].hasOwnProperty.call(thing, prop);
var get = (thing, prop, type = getArchtype(thing)) => (
  // @ts-ignore
  type === 2 ? thing.get(prop) : thing[prop]
);
var set = (thing, propOrOldValue, value, type = getArchtype(thing)) => {
  if (type === 2)
    thing.set(propOrOldValue, value);
  else if (type === 3) {
    thing.add(value);
  } else
    thing[propOrOldValue] = value;
};
function is(x, y2) {
  if (x === y2) {
    return x !== 0 || 1 / x === 1 / y2;
  } else {
    return x !== x && y2 !== y2;
  }
}
var isArray = Array.isArray;
var isMap = (target) => target instanceof Map;
var isSet = (target) => target instanceof Set;
var isObjectish = (target) => typeof target === "object";
var isFunction = (target) => typeof target === "function";
var isBoolean = (target) => typeof target === "boolean";
function isArrayIndex(value) {
  const n = +value;
  return Number.isInteger(n) && String(n) === value;
}
var latest = (state) => state.copy_ || state.base_;
var getFinalValue = (state) => state.modified_ ? state.copy_ : state.base_;
function shallowCopy(base, strict) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (isArray(base))
    return Array[PROTOTYPE].slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || strict === "class_only" && !isPlain) {
    const descriptors = O.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = descriptors[key];
      if (desc[WRITABLE] === false) {
        desc[WRITABLE] = true;
        desc[CONFIGURABLE] = true;
      }
      if (desc.get || desc.set)
        descriptors[key] = {
          [CONFIGURABLE]: true,
          [WRITABLE]: true,
          // could live with !!desc.set as well here...
          [ENUMERABLE]: desc[ENUMERABLE],
          [VALUE]: base[key]
        };
    }
    return O.create(getPrototypeOf(base), descriptors);
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = O.create(proto);
    return O.assign(obj, base);
  }
}
function freeze(obj, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
    return obj;
  if (getArchtype(obj) > 1) {
    O.defineProperties(obj, {
      set: dontMutateMethodOverride,
      add: dontMutateMethodOverride,
      clear: dontMutateMethodOverride,
      delete: dontMutateMethodOverride
    });
  }
  O.freeze(obj);
  if (deep)
    each(
      obj,
      (_key, value) => {
        freeze(value, true);
      },
      false
    );
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
var dontMutateMethodOverride = {
  [VALUE]: dontMutateFrozenCollections
};
function isFrozen(obj) {
  if (obj === null || !isObjectish(obj))
    return true;
  return O.isFrozen(obj);
}
var PluginMapSet = "MapSet";
var PluginPatches = "Patches";
var PluginArrayMethods = "ArrayMethods";
var plugins = {};
function getPlugin(pluginKey) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}
var isPluginLoaded = (pluginKey) => !!plugins[pluginKey];
var currentScope;
var getCurrentScope = () => currentScope;
var createScope = (parent_, immer_) => ({
  drafts_: [],
  parent_,
  immer_,
  // Whenever the modified draft contains a draft from another scope, we
  // need to prevent auto-freezing so the unowned draft can be finalized.
  canAutoFreeze_: true,
  unfinalizedDrafts_: 0,
  handledSet_: /* @__PURE__ */ new Set(),
  processedForPatches_: /* @__PURE__ */ new Set(),
  mapSetPlugin_: isPluginLoaded(PluginMapSet) ? getPlugin(PluginMapSet) : void 0,
  arrayMethodsPlugin_: isPluginLoaded(PluginArrayMethods) ? getPlugin(PluginArrayMethods) : void 0
});
function usePatchesInScope(scope, patchListener) {
  if (patchListener) {
    scope.patchPlugin_ = getPlugin(PluginPatches);
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
var enterScope = (immer22) => currentScope = createScope(currentScope, immer22);
function revokeDraft(draft) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 || state.type_ === 1)
    state.revoke_();
  else
    state.revoked_ = true;
}
function processResult(result, scope) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
    }
    const { patchPlugin_ } = scope;
    if (patchPlugin_) {
      patchPlugin_.generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope
      );
    }
  } else {
    result = finalize(scope, baseDraft);
  }
  maybeFreeze(scope, result, true);
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value) {
  if (isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  if (!state) {
    const finalValue = handleValue(value, rootScope.handledSet_, rootScope);
    return finalValue;
  }
  if (!isSameScope(state, rootScope)) {
    return value;
  }
  if (!state.modified_) {
    return state.base_;
  }
  if (!state.finalized_) {
    const { callbacks_ } = state;
    if (callbacks_) {
      while (callbacks_.length > 0) {
        const callback = callbacks_.pop();
        callback(rootScope);
      }
    }
    generatePatchesAndFinalize(state, rootScope);
  }
  return state.copy_;
}
function maybeFreeze(scope, value, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}
function markStateFinalized(state) {
  state.finalized_ = true;
  state.scope_.unfinalizedDrafts_--;
}
var isSameScope = (state, rootScope) => state.scope_ === rootScope;
var EMPTY_LOCATIONS_RESULT = [];
function updateDraftInParent(parent, draftValue, finalizedValue, originalKey) {
  const parentCopy = latest(parent);
  const parentType = parent.type_;
  if (originalKey !== void 0) {
    const currentValue = get(parentCopy, originalKey, parentType);
    if (currentValue === draftValue) {
      set(parentCopy, originalKey, finalizedValue, parentType);
      return;
    }
  }
  if (!parent.draftLocations_) {
    const draftLocations = parent.draftLocations_ = /* @__PURE__ */ new Map();
    each(parentCopy, (key, value) => {
      if (isDraft(value)) {
        const keys = draftLocations.get(value) || [];
        keys.push(key);
        draftLocations.set(value, keys);
      }
    });
  }
  const locations = parent.draftLocations_.get(draftValue) ?? EMPTY_LOCATIONS_RESULT;
  for (const location of locations) {
    set(parentCopy, location, finalizedValue, parentType);
  }
}
function registerChildFinalizationCallback(parent, child, key) {
  parent.callbacks_.push(function childCleanup(rootScope) {
    const state = child;
    if (!state || !isSameScope(state, rootScope)) {
      return;
    }
    rootScope.mapSetPlugin_?.fixSetContents(state);
    const finalizedValue = getFinalValue(state);
    updateDraftInParent(parent, state.draft_ ?? state, finalizedValue, key);
    generatePatchesAndFinalize(state, rootScope);
  });
}
function generatePatchesAndFinalize(state, rootScope) {
  const shouldFinalize = state.modified_ && !state.finalized_ && (state.type_ === 3 || state.type_ === 1 && state.allIndicesReassigned_ || (state.assigned_?.size ?? 0) > 0);
  if (shouldFinalize) {
    const { patchPlugin_ } = rootScope;
    if (patchPlugin_) {
      const basePath = patchPlugin_.getPath(state);
      if (basePath) {
        patchPlugin_.generatePatches_(state, basePath, rootScope);
      }
    }
    markStateFinalized(state);
  }
}
function handleCrossReference(target, key, value) {
  const { scope_ } = target;
  if (isDraft(value)) {
    const state = value[DRAFT_STATE];
    if (isSameScope(state, scope_)) {
      state.callbacks_.push(function crossReferenceCleanup() {
        prepareCopy(target);
        const finalizedValue = getFinalValue(state);
        updateDraftInParent(target, value, finalizedValue, key);
      });
    }
  } else if (isDraftable(value)) {
    target.callbacks_.push(function nestedDraftCleanup() {
      const targetCopy = latest(target);
      if (target.type_ === 3) {
        if (targetCopy.has(value)) {
          handleValue(value, scope_.handledSet_, scope_);
        }
      } else {
        if (get(targetCopy, key, target.type_) === value) {
          if (scope_.drafts_.length > 1 && (target.assigned_.get(key) ?? false) === true && target.copy_) {
            handleValue(
              get(target.copy_, key, target.type_),
              scope_.handledSet_,
              scope_
            );
          }
        }
      }
    });
  }
}
function handleValue(target, handledSet, rootScope) {
  if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
    return target;
  }
  if (isDraft(target) || handledSet.has(target) || !isDraftable(target) || isFrozen(target)) {
    return target;
  }
  handledSet.add(target);
  each(target, (key, value) => {
    if (isDraft(value)) {
      const state = value[DRAFT_STATE];
      if (isSameScope(state, rootScope)) {
        const updatedValue = getFinalValue(state);
        set(target, key, updatedValue, target.type_);
        markStateFinalized(state);
      }
    } else if (isDraftable(value)) {
      handleValue(value, handledSet, rootScope);
    }
  });
  return target;
}
function createProxyProxy(base, parent) {
  const baseIsArray = isArray(base);
  const state = {
    type_: baseIsArray ? 1 : 0,
    // Track which produce call this is associated with.
    scope_: parent ? parent.scope_ : getCurrentScope(),
    // True for both shallow and deep changes.
    modified_: false,
    // Used during finalization.
    finalized_: false,
    // Track which properties have been assigned (true) or deleted (false).
    // actually instantiated in `prepareCopy()`
    assigned_: void 0,
    // The parent draft state.
    parent_: parent,
    // The base state.
    base_: base,
    // The base proxy.
    draft_: null,
    // set below
    // The base copy with any updated values.
    copy_: null,
    // Called by the `produce` function.
    revoke_: null,
    isManual_: false,
    // `callbacks` actually gets assigned in `createProxy`
    callbacks_: void 0
  };
  let target = state;
  let traps = objectTraps;
  if (baseIsArray) {
    target = [state];
    traps = arrayTraps;
  }
  const { revoke, proxy } = Proxy.revocable(target, traps);
  state.draft_ = proxy;
  state.revoke_ = revoke;
  return [proxy, state];
}
var objectTraps = {
  get(state, prop) {
    if (prop === DRAFT_STATE)
      return state;
    let arrayPlugin = state.scope_.arrayMethodsPlugin_;
    const isArrayWithStringProp = state.type_ === 1 && typeof prop === "string";
    if (isArrayWithStringProp) {
      if (arrayPlugin?.isArrayOperationMethod(prop)) {
        return arrayPlugin.createMethodInterceptor(state, prop);
      }
    }
    const source = latest(state);
    if (!has(source, prop, state.type_)) {
      return readPropFromProto(state, source, prop);
    }
    const value = source[prop];
    if (state.finalized_ || !isDraftable(value)) {
      return value;
    }
    if (isArrayWithStringProp && state.operationMethod && arrayPlugin?.isMutatingArrayMethod(
      state.operationMethod
    ) && isArrayIndex(prop)) {
      return value;
    }
    if (value === peek(state.base_, prop)) {
      prepareCopy(state);
      const childKey = state.type_ === 1 ? +prop : prop;
      const childDraft = createProxy(state.scope_, value, state, childKey);
      return state.copy_[childKey] = childDraft;
    }
    return value;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  set(state, prop, value) {
    const desc = getDescriptorFromProto(latest(state), prop);
    if (desc?.set) {
      desc.set.call(state.draft_, value);
      return true;
    }
    if (!state.modified_) {
      const current2 = peek(latest(state), prop);
      const currentState = current2?.[DRAFT_STATE];
      if (currentState && currentState.base_ === value) {
        state.copy_[prop] = value;
        state.assigned_.set(prop, false);
        return true;
      }
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop, state.type_)))
        return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
    (value !== void 0 || prop in state.copy_) || // special case: NaN
    Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
      return true;
    state.copy_[prop] = value;
    state.assigned_.set(prop, true);
    handleCrossReference(state, prop, value);
    return true;
  },
  deleteProperty(state, prop) {
    prepareCopy(state);
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_.set(prop, false);
      markChanged(state);
    } else {
      state.assigned_.delete(prop);
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  // Note: We never coerce `desc.value` into an Immer draft, because we can't make
  // the same guarantee in ES5 mode.
  getOwnPropertyDescriptor(state, prop) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc)
      return desc;
    return {
      [WRITABLE]: true,
      [CONFIGURABLE]: state.type_ !== 1 || prop !== "length",
      [ENUMERABLE]: desc[ENUMERABLE],
      [VALUE]: owner[prop]
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  }
};
var arrayTraps = {};
for (let key in objectTraps) {
  let fn = objectTraps[key];
  arrayTraps[key] = function() {
    const args = arguments;
    args[0] = args[0][0];
    return fn.apply(this, args);
  };
}
arrayTraps.deleteProperty = function(state, prop) {
  if (false)
    die(13);
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
  if (false)
    die(14);
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function readPropFromProto(state, source, prop) {
  const desc = getDescriptorFromProto(source, prop);
  return desc ? VALUE in desc ? desc[VALUE] : (
    // This is a very special case, if the prop is a getter defined by the
    // prototype, we should invoke it with the draft as context!
    desc.get?.call(state.draft_)
  ) : void 0;
}
function getDescriptorFromProto(source, prop) {
  if (!(prop in source))
    return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state) {
  if (!state.copy_) {
    state.assigned_ = /* @__PURE__ */ new Map();
    state.copy_ = shallowCopy(
      state.base_,
      state.scope_.immer_.useStrictShallowCopy_
    );
  }
}
var Immer2 = class {
  constructor(config) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.useStrictIteration_ = false;
    this.produce = (base, recipe, patchListener) => {
      if (isFunction(base) && !isFunction(recipe)) {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args) {
          return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
        };
      }
      if (!isFunction(recipe))
        die(6);
      if (patchListener !== void 0 && !isFunction(patchListener))
        die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(scope, base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError)
            revokeScope(scope);
          else
            leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || !isObjectish(base)) {
        result = recipe(base);
        if (result === void 0)
          result = base;
        if (result === NOTHING)
          result = void 0;
        if (this.autoFreeze_)
          freeze(result, true);
        if (patchListener) {
          const p = [];
          const ip = [];
          getPlugin(PluginPatches).generateReplacementPatches_(base, result, {
            patches_: p,
            inversePatches_: ip
          });
          patchListener(p, ip);
        }
        return result;
      } else
        die(1, base);
    };
    this.produceWithPatches = (base, recipe) => {
      if (isFunction(base)) {
        return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p, ip) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (isBoolean(config?.autoFreeze))
      this.setAutoFreeze(config.autoFreeze);
    if (isBoolean(config?.useStrictShallowCopy))
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
    if (isBoolean(config?.useStrictIteration))
      this.setUseStrictIteration(config.useStrictIteration);
  }
  createDraft(base) {
    if (!isDraftable(base))
      die(8);
    if (isDraft(base))
      base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(scope, base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft, patchListener) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_)
      die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  /**
   * Pass true to automatically freeze all copies created by Immer.
   *
   * By default, auto-freezing is enabled.
   */
  setAutoFreeze(value) {
    this.autoFreeze_ = value;
  }
  /**
   * Pass true to enable strict shallow copy.
   *
   * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
   */
  setUseStrictShallowCopy(value) {
    this.useStrictShallowCopy_ = value;
  }
  /**
   * Pass false to use faster iteration that skips non-enumerable properties
   * but still handles symbols for compatibility.
   *
   * By default, strict iteration is enabled (includes all own properties).
   */
  setUseStrictIteration(value) {
    this.useStrictIteration_ = value;
  }
  shouldUseStrictIteration() {
    return this.useStrictIteration_;
  }
  applyPatches(base, patches) {
    let i;
    for (i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      if (patch.path.length === 0 && patch.op === "replace") {
        base = patch.value;
        break;
      }
    }
    if (i > -1) {
      patches = patches.slice(i + 1);
    }
    const applyPatchesImpl = getPlugin(PluginPatches).applyPatches_;
    if (isDraft(base)) {
      return applyPatchesImpl(base, patches);
    }
    return this.produce(
      base,
      (draft) => applyPatchesImpl(draft, patches)
    );
  }
};
function createProxy(rootScope, value, parent, key) {
  const [draft, state] = isMap(value) ? getPlugin(PluginMapSet).proxyMap_(value, parent) : isSet(value) ? getPlugin(PluginMapSet).proxySet_(value, parent) : createProxyProxy(value, parent);
  const scope = parent?.scope_ ?? getCurrentScope();
  scope.drafts_.push(draft);
  state.callbacks_ = parent?.callbacks_ ?? [];
  state.key_ = key;
  if (parent && key !== void 0) {
    registerChildFinalizationCallback(parent, state, key);
  } else {
    state.callbacks_.push(function rootDraftCleanup(rootScope2) {
      rootScope2.mapSetPlugin_?.fixSetContents(state);
      const { patchPlugin_ } = rootScope2;
      if (state.modified_ && patchPlugin_) {
        patchPlugin_.generatePatches_(state, [], rootScope2);
      }
    });
  }
  return draft;
}
function current(value) {
  if (!isDraft(value))
    die(10, value);
  return currentImpl(value);
}
function currentImpl(value) {
  if (!isDraftable(value) || isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  let copy;
  let strict = true;
  if (state) {
    if (!state.modified_)
      return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
    strict = state.scope_.immer_.shouldUseStrictIteration();
  } else {
    copy = shallowCopy(value, true);
  }
  each(
    copy,
    (key, childValue) => {
      set(copy, key, currentImpl(childValue));
    },
    strict
  );
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}
var immer = new Immer2();
var produce = immer.produce;
var setAutoFreeze = /* @__PURE__ */ immer.setAutoFreeze.bind(immer);

// node_modules/zustand/esm/middleware/immer.mjs
var immerImpl = (initializer) => (set2, get2, store) => {
  store.setState = (updater, replace, ...a) => {
    const nextState = typeof updater === "function" ? produce(updater) : updater;
    return set2(nextState, replace, ...a);
  };
  return initializer(store.setState, get2, store);
};
var immer2 = immerImpl;

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => {
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
};

// src/lib/id.ts
function generateId() {
  return nanoid(12);
}

// src/constants/defaults.ts
var createDefaultPKColumn = (overrides) => ({
  id: generateId(),
  name: "id",
  dataType: "INT",
  nullable: false,
  autoIncrement: true,
  isPrimaryKey: true,
  isUnique: false,
  ...overrides
});

// src/store/slices/schema-slice.ts
var createSchemaSlice = (set2) => ({
  tables: {},
  relationships: {},
  addTable: (tableData) => {
    const id = generateId();
    const table = {
      id,
      name: tableData.name,
      columns: tableData.columns ?? [createDefaultPKColumn()],
      indexes: tableData.indexes ?? [],
      schema: tableData.schema,
      comment: tableData.comment,
      engine: tableData.engine,
      charset: tableData.charset,
      layerId: tableData.layerId,
      color: tableData.color
    };
    set2((state) => {
      state.tables[id] = table;
    });
    return id;
  },
  updateTable: (tableId, updates) => {
    set2((state) => {
      if (state.tables[tableId]) {
        Object.assign(state.tables[tableId], updates);
      }
    });
  },
  removeTable: (tableId) => {
    set2((state) => {
      delete state.tables[tableId];
      for (const [relId, rel] of Object.entries(state.relationships)) {
        if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
          delete state.relationships[relId];
        }
      }
      state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== tableId);
    });
  },
  duplicateTable: (tableId) => {
    let newId = null;
    set2((state) => {
      const original = state.tables[tableId];
      if (!original) return;
      newId = generateId();
      const duplicated = {
        ...JSON.parse(JSON.stringify(original)),
        id: newId,
        name: `${original.name}_copy`,
        columns: original.columns.map((col) => ({ ...col, id: generateId() })),
        indexes: original.indexes.map((idx) => ({ ...idx, id: generateId() }))
      };
      state.tables[newId] = duplicated;
      const pos = state.nodePositions[tableId];
      if (pos) {
        state.nodePositions[newId] = { x: pos.x + 40, y: pos.y + 40 };
      }
    });
    return newId;
  },
  addColumn: (tableId, column) => {
    set2((state) => {
      const table = state.tables[tableId];
      if (table) {
        table.columns.push({
          id: generateId(),
          name: column?.name ?? "new_column",
          dataType: column?.dataType ?? "VARCHAR",
          nullable: column?.nullable ?? true,
          autoIncrement: column?.autoIncrement ?? false,
          isPrimaryKey: column?.isPrimaryKey ?? false,
          isUnique: column?.isUnique ?? false,
          defaultValue: column?.defaultValue,
          comment: column?.comment,
          length: column?.length,
          precision: column?.precision,
          scale: column?.scale,
          enumValues: column?.enumValues
        });
      }
    });
  },
  updateColumn: (tableId, columnId, updates) => {
    set2((state) => {
      const table = state.tables[tableId];
      if (table) {
        const col = table.columns.find((c) => c.id === columnId);
        if (col) {
          Object.assign(col, updates);
        }
      }
    });
  },
  removeColumn: (tableId, columnId) => {
    set2((state) => {
      const table = state.tables[tableId];
      if (table) {
        table.columns = table.columns.filter((c) => c.id !== columnId);
      }
    });
  },
  reorderColumns: (tableId, columnIds) => {
    set2((state) => {
      const table = state.tables[tableId];
      if (table) {
        const columnMap = new Map(table.columns.map((c) => [c.id, c]));
        table.columns = columnIds.map((id) => columnMap.get(id)).filter(Boolean);
      }
    });
  },
  addRelationship: (relData) => {
    const id = generateId();
    set2((state) => {
      state.relationships[id] = { ...relData, id };
    });
    return id;
  },
  updateRelationship: (relId, updates) => {
    set2((state) => {
      if (state.relationships[relId]) {
        Object.assign(state.relationships[relId], updates);
      }
    });
  },
  removeRelationship: (relId) => {
    set2((state) => {
      delete state.relationships[relId];
      state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => id !== relId);
    });
  },
  loadProject: (data) => {
    set2((state) => {
      state.tables = data.tables;
      state.relationships = data.relationships;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
  resetSchema: () => {
    set2((state) => {
      state.tables = {};
      state.relationships = {};
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
  loadSchema: (tables, relationships) => {
    set2((state) => {
      Object.assign(state.tables, tables);
      Object.assign(state.relationships, relationships);
    });
  },
  clearSchema: () => {
    set2((state) => {
      state.tables = {};
      state.relationships = {};
      state.nodePositions = {};
      state.collapsedNodes = {};
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  }
});

// src/store/slices/diagram-slice.ts
function sameStringArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
var createDiagramSlice = (set2) => ({
  nodePositions: {},
  collapsedNodes: {},
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  selectedEdgeIds: [],
  setNodePosition: (nodeId, position) => {
    set2((state) => {
      state.nodePositions[nodeId] = position;
    });
  },
  setNodePositions: (positions) => {
    set2((state) => {
      Object.assign(state.nodePositions, positions);
    });
  },
  toggleNodeCollapsed: (nodeId) => {
    set2((state) => {
      state.collapsedNodes[nodeId] = !state.collapsedNodes[nodeId];
    });
  },
  setAllCollapsed: (collapsed) => {
    set2((state) => {
      const tableIds = Object.keys(state.tables);
      if (collapsed) {
        for (const id of tableIds) {
          state.collapsedNodes[id] = true;
        }
      } else {
        state.collapsedNodes = {};
      }
    });
  },
  setViewport: (viewport) => {
    set2((state) => {
      state.viewport = viewport;
    });
  },
  setSelectedNodeIds: (ids) => {
    set2((state) => {
      const sameNodes = sameStringArray(state.selectedNodeIds, ids);
      const shouldClearEdges = ids.length > 0 && state.selectedEdgeIds.length > 0;
      if (sameNodes && !shouldClearEdges) return;
      state.selectedNodeIds = ids;
      if (shouldClearEdges) {
        state.selectedEdgeIds = [];
      }
    });
  },
  setSelectedEdgeIds: (ids) => {
    set2((state) => {
      const sameEdges = sameStringArray(state.selectedEdgeIds, ids);
      const shouldClearNodes = ids.length > 0 && state.selectedNodeIds.length > 0;
      if (sameEdges && !shouldClearNodes) return;
      state.selectedEdgeIds = ids;
      if (shouldClearNodes) {
        state.selectedNodeIds = [];
      }
    });
  },
  clearSelection: () => {
    set2((state) => {
      if (state.selectedNodeIds.length === 0 && state.selectedEdgeIds.length === 0) return;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
  loadDiagramState: (data) => {
    set2((state) => {
      state.nodePositions = data.nodePositions;
      state.collapsedNodes = data.collapsedNodes;
      state.viewport = data.viewport;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
  resetDiagram: () => {
    set2((state) => {
      state.nodePositions = {};
      state.collapsedNodes = {};
      state.viewport = { x: 0, y: 0, zoom: 1 };
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  }
});

// src/store/slices/ui-slice.ts
var createUISlice = (set2) => ({
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  bottomPanelOpen: true,
  bottomPanelTab: "sql",
  createTableDialogOpen: false,
  importSQLDialogOpen: false,
  importMermaidDialogOpen: false,
  importMWBDialogOpen: false,
  dialect: "mysql",
  theme: "dark",
  showMinimap: true,
  showGrid: true,
  renderQualityLevel: 1,
  showOnlyVisibleRelatedEdges: true,
  showOnlySelectedRelatedEdges: false,
  edgeWorkerEnabled: false,
  edgeRoutingMode: "direct",
  relationshipCreateMode: null,
  relationshipCreateSourceTableId: null,
  autoLayoutTrigger: 0,
  autoLayoutRunning: false,
  zoomInFn: null,
  zoomOutFn: null,
  setZoomToFn: null,
  panToFn: null,
  fitViewFn: null,
  triggerAutoLayout: () => set2((state) => {
    state.autoLayoutTrigger += 1;
  }),
  setAutoLayoutRunning: (running) => set2((state) => {
    state.autoLayoutRunning = running;
  }),
  setZoomInFn: (fn) => set2((state) => {
    state.zoomInFn = fn;
  }),
  setZoomOutFn: (fn) => set2((state) => {
    state.zoomOutFn = fn;
  }),
  setSetZoomToFn: (fn) => set2((state) => {
    state.setZoomToFn = fn;
  }),
  setPanToFn: (fn) => set2((state) => {
    state.panToFn = fn;
  }),
  toggleLeftSidebar: () => set2((state) => {
    state.leftSidebarOpen = !state.leftSidebarOpen;
  }),
  toggleRightSidebar: () => set2((state) => {
    state.rightSidebarOpen = !state.rightSidebarOpen;
  }),
  toggleBottomPanel: () => set2((state) => {
    state.bottomPanelOpen = !state.bottomPanelOpen;
  }),
  setBottomPanelTab: (tab) => set2((state) => {
    state.bottomPanelTab = tab;
  }),
  setCreateTableDialogOpen: (open) => set2((state) => {
    state.createTableDialogOpen = open;
  }),
  setImportSQLDialogOpen: (open) => set2((state) => {
    state.importSQLDialogOpen = open;
  }),
  setImportMermaidDialogOpen: (open) => set2((state) => {
    state.importMermaidDialogOpen = open;
  }),
  setImportMWBDialogOpen: (open) => set2((state) => {
    state.importMWBDialogOpen = open;
  }),
  setDialect: (dialect) => set2((state) => {
    state.dialect = dialect;
  }),
  setTheme: (theme) => set2((state) => {
    state.theme = theme;
  }),
  toggleMinimap: () => set2((state) => {
    state.showMinimap = !state.showMinimap;
  }),
  toggleGrid: () => set2((state) => {
    state.showGrid = !state.showGrid;
  }),
  setRenderQualityLevel: (level) => set2((state) => {
    state.renderQualityLevel = level;
  }),
  toggleOnlyVisibleRelatedEdges: () => set2((state) => {
    state.showOnlyVisibleRelatedEdges = !state.showOnlyVisibleRelatedEdges;
  }),
  toggleOnlySelectedRelatedEdges: () => set2((state) => {
    state.showOnlySelectedRelatedEdges = !state.showOnlySelectedRelatedEdges;
  }),
  toggleEdgeWorkerEnabled: () => set2((state) => {
    state.edgeWorkerEnabled = !state.edgeWorkerEnabled;
  }),
  setEdgeRoutingMode: (mode) => set2((state) => {
    state.edgeRoutingMode = mode;
  }),
  setRelationshipCreateMode: (mode) => set2((state) => {
    state.relationshipCreateMode = mode;
    if (mode === null) state.relationshipCreateSourceTableId = null;
  }),
  setRelationshipCreateSourceTableId: (tableId) => set2((state) => {
    state.relationshipCreateSourceTableId = tableId;
  }),
  clearRelationshipCreateState: () => set2((state) => {
    state.relationshipCreateMode = null;
    state.relationshipCreateSourceTableId = null;
  }),
  setFitViewFn: (fn) => set2((state) => {
    state.fitViewFn = fn;
  })
});

// src/features/migration/operations/inverse.ts
function generateInverse(op) {
  const p = op.params;
  switch (op.type) {
    case "createTable":
      return {
        ...op,
        type: "dropTable",
        params: { name: p.name, _tableData: op.params }
      };
    case "dropTable":
      return p._tableData ? { ...op, type: "createTable", params: p._tableData } : null;
    case "renameTable":
      return {
        ...op,
        type: "renameTable",
        params: { oldName: p.newName, newName: p.oldName }
      };
    case "addColumn":
      return {
        ...op,
        type: "dropColumn",
        params: { table: p.table, name: p.name, _columnData: op.params }
      };
    case "dropColumn":
      return p._columnData ? { ...op, type: "addColumn", params: p._columnData } : null;
    case "renameColumn":
      return {
        ...op,
        type: "renameColumn",
        params: { table: p.table, oldName: p.newName, newName: p.oldName }
      };
    case "modifyColumnType":
      return {
        ...op,
        type: "modifyColumnType",
        params: { table: p.table, column: p.column, oldType: p.newType, newType: p.oldType }
      };
    case "modifyColumnDefault":
      return {
        ...op,
        type: "modifyColumnDefault",
        params: { table: p.table, column: p.column, oldDefault: p.newDefault, newDefault: p.oldDefault }
      };
    case "setColumnNullable":
      return {
        ...op,
        type: "setColumnNullable",
        params: { table: p.table, column: p.column, nullable: p.oldNullable, oldNullable: p.nullable }
      };
    case "setColumnAutoIncrement":
      return {
        ...op,
        type: "setColumnAutoIncrement",
        params: { table: p.table, column: p.column, autoIncrement: !p.autoIncrement }
      };
    case "setColumnUnique":
      return {
        ...op,
        type: "setColumnUnique",
        params: { table: p.table, column: p.column, unique: !p.unique }
      };
    case "addPrimaryKey":
      return {
        ...op,
        type: "dropPrimaryKey",
        params: { table: p.table, columns: p.columns }
      };
    case "dropPrimaryKey":
      return {
        ...op,
        type: "addPrimaryKey",
        params: { table: p.table, columns: p.columns }
      };
    case "addForeignKey": {
      const fkName = p.name ?? `fk_${p.table}_${p.columns[0]}`;
      return {
        ...op,
        type: "dropForeignKey",
        params: { table: p.table, name: fkName, _fkData: op.params }
      };
    }
    case "dropForeignKey":
      return p._fkData ? { ...op, type: "addForeignKey", params: p._fkData } : null;
    case "addUniqueConstraint": {
      const uqName = p.name ?? `uq_${p.table}_${p.columns[0]}`;
      return {
        ...op,
        type: "dropUniqueConstraint",
        params: { table: p.table, name: uqName, columns: p.columns }
      };
    }
    case "dropUniqueConstraint":
      return p.columns ? { ...op, type: "addUniqueConstraint", params: { table: p.table, name: p.name, columns: p.columns } } : null;
    case "createIndex":
      return {
        ...op,
        type: "dropIndex",
        params: { table: p.table, name: p.name, _indexData: op.params }
      };
    case "dropIndex":
      return p._indexData ? { ...op, type: "createIndex", params: p._indexData } : null;
    default:
      return null;
  }
}

// src/features/migration/sql-generator/mysql-generator.ts
var MySQLGenerator = class {
  dialect = "mysql";
  generate(op) {
    const p = op.params;
    switch (op.type) {
      case "createTable": {
        const columns = p.columns ?? [];
        const colDefs = columns.map((c) => {
          let def = `  \`${c.name}\` ${c.dataType}`;
          if (c.length) def += `(${c.length})`;
          if (c.autoIncrement) def += " AUTO_INCREMENT";
          if (!c.nullable) def += " NOT NULL";
          if (c.defaultValue != null) def += ` DEFAULT ${c.defaultValue}`;
          if (c.isUnique) def += " UNIQUE";
          if (c.comment) def += ` COMMENT '${c.comment}'`;
          return def;
        });
        const pks = columns.filter((c) => c.isPrimaryKey).map((c) => `\`${c.name}\``);
        if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(", ")})`);
        let sql = `CREATE TABLE \`${p.name}\` (
${colDefs.join(",\n")}
)`;
        if (p.engine) sql += ` ENGINE=${p.engine}`;
        if (p.charset) sql += ` DEFAULT CHARSET=${p.charset}`;
        if (p.comment) sql += ` COMMENT='${p.comment}'`;
        return sql + ";";
      }
      case "dropTable":
        return `DROP TABLE IF EXISTS \`${p.name}\`;`;
      case "renameTable":
        return `ALTER TABLE \`${p.oldName}\` RENAME TO \`${p.newName}\`;`;
      case "addColumn": {
        let sql = `ALTER TABLE \`${p.table}\` ADD COLUMN \`${p.name}\` ${p.dataType ?? "VARCHAR(255)"}`;
        if (!(p.nullable ?? true)) sql += " NOT NULL";
        if (p.defaultValue != null) sql += ` DEFAULT ${p.defaultValue}`;
        if (p.autoIncrement) sql += " AUTO_INCREMENT";
        if (p.isUnique) sql += " UNIQUE";
        if (p.after) sql += ` AFTER \`${p.after}\``;
        return sql + ";";
      }
      case "dropColumn":
        return `ALTER TABLE \`${p.table}\` DROP COLUMN \`${p.name}\`;`;
      case "renameColumn":
        return `ALTER TABLE \`${p.table}\` RENAME COLUMN \`${p.oldName}\` TO \`${p.newName}\`;`;
      case "modifyColumnType":
        return `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` ${p.newType};`;
      case "modifyColumnDefault":
        return p.newDefault != null ? `ALTER TABLE \`${p.table}\` ALTER COLUMN \`${p.column}\` SET DEFAULT ${p.newDefault};` : `ALTER TABLE \`${p.table}\` ALTER COLUMN \`${p.column}\` DROP DEFAULT;`;
      case "setColumnNullable":
        return p.nullable ? `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` NULL;` : `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` NOT NULL;`;
      case "setColumnAutoIncrement":
        return p.autoIncrement ? `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` AUTO_INCREMENT;` : `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\`;`;
      case "setColumnUnique":
        return p.unique ? `ALTER TABLE \`${p.table}\` ADD UNIQUE (\`${p.column}\`);` : `ALTER TABLE \`${p.table}\` DROP INDEX \`${p.column}\`;`;
      case "addPrimaryKey": {
        const cols = p.columns.map((c) => `\`${c}\``).join(", ");
        return `ALTER TABLE \`${p.table}\` ADD PRIMARY KEY (${cols});`;
      }
      case "dropPrimaryKey":
        return `ALTER TABLE \`${p.table}\` DROP PRIMARY KEY;`;
      case "addForeignKey": {
        const name = p.name ?? `fk_${p.table}_${p.columns[0]}`;
        const cols = p.columns.map((c) => `\`${c}\``).join(", ");
        const refCols = p.refColumns.map((c) => `\`${c}\``).join(", ");
        return `ALTER TABLE \`${p.table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (${cols}) REFERENCES \`${p.refTable}\`(${refCols}) ON DELETE ${p.onDelete} ON UPDATE ${p.onUpdate};`;
      }
      case "dropForeignKey":
        return `ALTER TABLE \`${p.table}\` DROP FOREIGN KEY \`${p.name}\`;`;
      case "addUniqueConstraint": {
        const name = p.name ?? `uq_${p.table}_${p.columns[0]}`;
        const cols = p.columns.map((c) => `\`${c}\``).join(", ");
        return `ALTER TABLE \`${p.table}\` ADD CONSTRAINT \`${name}\` UNIQUE (${cols});`;
      }
      case "dropUniqueConstraint":
        return `ALTER TABLE \`${p.table}\` DROP INDEX \`${p.name}\`;`;
      case "createIndex": {
        const unique = p.unique ? "UNIQUE " : "";
        const cols = p.columns.map((c) => `\`${c}\``).join(", ");
        return `CREATE ${unique}INDEX \`${p.name}\` ON \`${p.table}\`(${cols});`;
      }
      case "dropIndex":
        return `DROP INDEX \`${p.name}\` ON \`${p.table}\`;`;
      default:
        return `-- Unknown operation: ${op.type}`;
    }
  }
  generateBatch(ops) {
    return ops.map((op) => this.generate(op)).join("\n\n");
  }
};

// src/features/migration/sql-generator/postgresql-generator.ts
var PostgreSQLGenerator = class {
  dialect = "postgresql";
  generate(op) {
    const p = op.params;
    switch (op.type) {
      case "createTable": {
        const columns = p.columns ?? [];
        const colDefs = columns.map((c) => {
          const isSerial = c.autoIncrement && /^(INT|INTEGER|BIGINT)/i.test(c.dataType);
          let def;
          if (isSerial) {
            const serialType = /^BIGINT/i.test(c.dataType) ? "BIGSERIAL" : "SERIAL";
            def = `  "${c.name}" ${serialType}`;
          } else {
            def = `  "${c.name}" ${c.dataType}`;
            if (c.length) def += `(${c.length})`;
          }
          if (!c.nullable) def += " NOT NULL";
          if (c.defaultValue != null && !isSerial) def += ` DEFAULT ${c.defaultValue}`;
          if (c.isUnique) def += " UNIQUE";
          return def;
        });
        const pks = columns.filter((c) => c.isPrimaryKey).map((c) => `"${c.name}"`);
        if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(", ")})`);
        const schemaPrefix = p.schema ? `"${p.schema}".` : "";
        let sql = `CREATE TABLE ${schemaPrefix}"${p.name}" (
${colDefs.join(",\n")}
)`;
        if (p.comment) sql += `;
COMMENT ON TABLE ${schemaPrefix}"${p.name}" IS '${p.comment}'`;
        return sql + ";";
      }
      case "dropTable": {
        const schemaPrefix = p.schema ? `"${p.schema}".` : "";
        return `DROP TABLE IF EXISTS ${schemaPrefix}"${p.name}" CASCADE;`;
      }
      case "renameTable":
        return `ALTER TABLE "${p.oldName}" RENAME TO "${p.newName}";`;
      case "addColumn": {
        const isSerial = p.autoIncrement && /^(INT|INTEGER|BIGINT)/i.test(p.dataType ?? "");
        let colType;
        if (isSerial) {
          colType = /^BIGINT/i.test(p.dataType ?? "") ? "BIGSERIAL" : "SERIAL";
        } else {
          colType = p.dataType ?? "VARCHAR(255)";
        }
        let sql = `ALTER TABLE "${p.table}" ADD COLUMN "${p.name}" ${colType}`;
        if (!(p.nullable ?? true)) sql += " NOT NULL";
        if (p.defaultValue != null && !isSerial) sql += ` DEFAULT ${p.defaultValue}`;
        if (p.isUnique) sql += " UNIQUE";
        return sql + ";";
      }
      case "dropColumn":
        return `ALTER TABLE "${p.table}" DROP COLUMN "${p.name}";`;
      case "renameColumn":
        return `ALTER TABLE "${p.table}" RENAME COLUMN "${p.oldName}" TO "${p.newName}";`;
      case "modifyColumnType":
        return `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" TYPE ${p.newType};`;
      case "modifyColumnDefault":
        return p.newDefault != null ? `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET DEFAULT ${p.newDefault};` : `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP DEFAULT;`;
      case "setColumnNullable":
        return p.nullable ? `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP NOT NULL;` : `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET NOT NULL;`;
      case "setColumnAutoIncrement": {
        const seqName = `${p.table}_${p.column}_seq`;
        if (p.autoIncrement) {
          return [
            `CREATE SEQUENCE "${seqName}";`,
            `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET DEFAULT nextval('"${seqName}"');`,
            `ALTER SEQUENCE "${seqName}" OWNED BY "${p.table}"."${p.column}";`
          ].join("\n");
        }
        return `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP DEFAULT;`;
      }
      case "setColumnUnique":
        if (p.unique) {
          const constraintName = `uq_${p.table}_${p.column}`;
          return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${constraintName}" UNIQUE ("${p.column}");`;
        }
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "uq_${p.table}_${p.column}";`;
      case "addPrimaryKey": {
        const cols = p.columns.map((c) => `"${c}"`).join(", ");
        return `ALTER TABLE "${p.table}" ADD PRIMARY KEY (${cols});`;
      }
      case "dropPrimaryKey":
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT "${p.table}_pkey";`;
      case "addForeignKey": {
        const name = p.name ?? `fk_${p.table}_${p.columns[0]}`;
        const cols = p.columns.map((c) => `"${c}"`).join(", ");
        const refCols = p.refColumns.map((c) => `"${c}"`).join(", ");
        return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${name}" FOREIGN KEY (${cols}) REFERENCES "${p.refTable}"(${refCols}) ON DELETE ${p.onDelete} ON UPDATE ${p.onUpdate};`;
      }
      case "dropForeignKey":
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "${p.name}";`;
      case "addUniqueConstraint": {
        const name = p.name ?? `uq_${p.table}_${p.columns[0]}`;
        const cols = p.columns.map((c) => `"${c}"`).join(", ");
        return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${name}" UNIQUE (${cols});`;
      }
      case "dropUniqueConstraint":
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "${p.name}";`;
      case "createIndex": {
        const unique = p.unique ? "UNIQUE " : "";
        const cols = p.columns.map((c) => `"${c}"`).join(", ");
        return `CREATE ${unique}INDEX "${p.name}" ON "${p.table}"(${cols});`;
      }
      case "dropIndex":
        return `DROP INDEX IF EXISTS "${p.name}";`;
      default:
        return `-- Unknown operation: ${op.type}`;
    }
  }
  generateBatch(ops) {
    return ops.map((op) => this.generate(op)).join("\n\n");
  }
};

// src/features/migration/sql-generator/index.ts
var generators = {
  mysql: new MySQLGenerator(),
  postgresql: new PostgreSQLGenerator()
};
function getSQLGenerator(dialect) {
  return generators[dialect];
}

// src/store/slices/migration-slice.ts
var createMigrationSlice = (set2, get2) => ({
  migrationHistory: [],
  uncommittedOps: [],
  recordOperation: (type, params) => {
    set2((state) => {
      state.uncommittedOps.push({
        id: generateId(),
        type,
        timestamp: Date.now(),
        params
      });
    });
  },
  commitVersion: (title) => {
    set2((state) => {
      if (state.uncommittedOps.length === 0) return;
      const version = {
        id: generateId(),
        version: String(state.migrationHistory.length + 1).padStart(3, "0"),
        title,
        date: (/* @__PURE__ */ new Date()).toISOString(),
        operations: [...state.uncommittedOps]
      };
      state.migrationHistory.push(version);
      state.uncommittedOps = [];
    });
  },
  getVersionSQL: (versionId, dialect) => {
    const state = get2();
    const version = state.migrationHistory.find((v2) => v2.id === versionId);
    if (!version) return "";
    const generator = getSQLGenerator(dialect);
    return `-- Migration: ${version.version} - ${version.title}
-- Date: ${version.date}

${generator.generateBatch(version.operations)}`;
  },
  getUncommittedSQL: (dialect) => {
    const state = get2();
    if (state.uncommittedOps.length === 0) return "-- No uncommitted changes";
    const generator = getSQLGenerator(dialect);
    return `-- Uncommitted changes

${generator.generateBatch(state.uncommittedOps)}`;
  },
  getAllMigrationsSQL: (dialect) => {
    const state = get2();
    const generator = getSQLGenerator(dialect);
    const sections = state.migrationHistory.map(
      (v2) => `-- Migration: ${v2.version} - ${v2.title}
-- Date: ${v2.date}

${generator.generateBatch(v2.operations)}`
    );
    return sections.join("\n\n-- ========================================\n\n");
  },
  undoLastOperation: () => {
    const state = get2();
    const ops = state.uncommittedOps;
    if (ops.length === 0) return null;
    const lastOp = ops[ops.length - 1];
    const inverse = generateInverse(lastOp);
    set2((s) => {
      s.uncommittedOps.pop();
    });
    return inverse;
  }
});

// src/store/index.ts
setAutoFreeze(false);
var useStore2 = create()(
  immer2((...a) => ({
    ...createSchemaSlice(...a),
    ...createDiagramSlice(...a),
    ...createUISlice(...a),
    ...createMigrationSlice(...a)
  }))
);

// src/plugin/resolve.ts
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j2 = 0; j2 <= n; j2++) prev[j2] = j2;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j2 = 1; j2 <= n; j2++) {
      const cost = a[i - 1] === b[j2 - 1] ? 0 : 1;
      curr[j2] = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
    }
    for (let j2 = 0; j2 <= n; j2++) prev[j2] = curr[j2];
  }
  return prev[n];
}
function nearMatches(arg, names, limit = 3) {
  const lowered = arg.toLowerCase();
  const threshold = Math.max(2, Math.floor(arg.length / 3));
  return names.map((name) => ({ name, d: editDistance(lowered, name.toLowerCase()) })).filter((x) => x.d <= threshold || x.name.toLowerCase().includes(lowered)).sort((a, b) => a.d - b.d).slice(0, limit).map((x) => x.name);
}
function resolveTable(store, arg) {
  if (!arg || typeof arg !== "string") {
    return { ok: false, error: "table identifier required" };
  }
  const tables = store.getState().tables;
  const all = Object.values(tables);
  const byName = all.filter((t) => t.name.toLowerCase() === arg.toLowerCase());
  if (byName.length === 1) return { ok: true, id: byName[0].id };
  if (byName.length > 1) {
    return {
      ok: false,
      error: `ambiguous table name '${arg}' (${byName.length} matches)`,
      candidates: byName.map((t) => t.id)
    };
  }
  if (tables[arg]) return { ok: true, id: arg };
  const names = all.map((t) => t.name);
  const dym = nearMatches(arg, names);
  return {
    ok: false,
    error: `table not found: '${arg}'`,
    ...dym.length > 0 ? { did_you_mean: dym } : {}
  };
}
function resolveColumn(table, arg) {
  if (!arg || typeof arg !== "string") {
    return { ok: false, error: "column identifier required" };
  }
  const byName = table.columns.filter((c) => c.name.toLowerCase() === arg.toLowerCase());
  if (byName.length === 1) return { ok: true, id: byName[0].id };
  if (byName.length > 1) {
    return {
      ok: false,
      error: `ambiguous column name '${arg}' in '${table.name}'`,
      candidates: byName.map((c) => c.id)
    };
  }
  const byId = table.columns.find((c) => c.id === arg);
  if (byId) return { ok: true, id: byId.id };
  const dym = nearMatches(arg, table.columns.map((c) => c.name));
  return {
    ok: false,
    error: `column not found: '${arg}' in '${table.name}'`,
    ...dym.length > 0 ? { did_you_mean: dym } : {}
  };
}
function getTable(store, arg) {
  const r = resolveTable(store, arg);
  if (!r.ok) return r;
  const table = store.getState().tables[r.id];
  if (!table) return { ok: false, error: `table not found: '${arg}'` };
  return { ok: true, table, id: r.id };
}

// src/features/validation/schema-validator.ts
function validateSchema(schema) {
  const issues = [];
  const tables = Object.values(schema.tables);
  const relationships = Object.values(schema.relationships);
  if (tables.length === 0) {
    issues.push({ level: "info", message: "No tables defined in the schema" });
    return issues;
  }
  const nameCount = /* @__PURE__ */ new Map();
  for (const table of tables) {
    nameCount.set(table.name, (nameCount.get(table.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      issues.push({ level: "error", message: `Duplicate table name '${name}' (${count} occurrences)` });
    }
  }
  for (const table of tables) {
    if (table.columns.length === 0) {
      issues.push({
        level: "error",
        message: `Table '${table.name}' has no columns`,
        table: table.name
      });
    }
    if (!table.columns.some((c) => c.isPrimaryKey)) {
      issues.push({
        level: "warning",
        message: `Table '${table.name}' has no primary key`,
        table: table.name
      });
    }
    const colNameCount = /* @__PURE__ */ new Map();
    for (const col of table.columns) {
      colNameCount.set(col.name, (colNameCount.get(col.name) ?? 0) + 1);
    }
    for (const [name, count] of colNameCount) {
      if (count > 1) {
        issues.push({
          level: "error",
          message: `Table '${table.name}' has duplicate column name '${name}'`,
          table: table.name
        });
      }
    }
  }
  const tableIds = new Set(tables.map((t) => t.id));
  for (const rel of relationships) {
    if (!tableIds.has(rel.sourceTableId)) {
      issues.push({
        level: "error",
        message: `Relationship '${rel.name ?? rel.id}' references non-existent source table`
      });
    }
    if (!tableIds.has(rel.targetTableId)) {
      issues.push({
        level: "error",
        message: `Relationship '${rel.name ?? rel.id}' references non-existent target table`
      });
    }
  }
  const graph = /* @__PURE__ */ new Map();
  for (const table of tables) {
    graph.set(table.id, /* @__PURE__ */ new Set());
  }
  for (const rel of relationships) {
    if (graph.has(rel.sourceTableId)) {
      graph.get(rel.sourceTableId).add(rel.targetTableId);
    }
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  function hasCycle(nodeId) {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of graph.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }
  for (const tableId of graph.keys()) {
    if (!visited.has(tableId) && hasCycle(tableId)) {
      issues.push({
        level: "warning",
        message: "Circular foreign key reference detected in the schema"
      });
      break;
    }
  }
  if (issues.length === 0) {
    issues.push({ level: "info", message: "No issues found" });
  }
  return issues;
}

// node_modules/@dagrejs/dagre/dist/dagre.esm.js
var v = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var y = v((Fi, ee) => {
  var Vt = Object.defineProperty, At = (e, t, r) => t in e ? Vt(e, t, { enumerable: true, configurable: true, writable: true, value: r }) : e[t] = r, E = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), k = (e, t, r) => At(e, typeof t != "symbol" ? t + "" : t, r), R = E((e, t) => {
    "use strict";
    var r = "\0", n = "\0", i = "", o = class {
      constructor(d) {
        k(this, "_isDirected", true), k(this, "_isMultigraph", false), k(this, "_isCompound", false), k(this, "_label"), k(this, "_defaultNodeLabelFn", () => {
        }), k(this, "_defaultEdgeLabelFn", () => {
        }), k(this, "_nodes", {}), k(this, "_in", {}), k(this, "_preds", {}), k(this, "_out", {}), k(this, "_sucs", {}), k(this, "_edgeObjs", {}), k(this, "_edgeLabels", {}), k(this, "_nodeCount", 0), k(this, "_edgeCount", 0), k(this, "_parent"), k(this, "_children"), d && (this._isDirected = Object.hasOwn(d, "directed") ? d.directed : true, this._isMultigraph = Object.hasOwn(d, "multigraph") ? d.multigraph : false, this._isCompound = Object.hasOwn(d, "compound") ? d.compound : false), this._isCompound && (this._parent = {}, this._children = {}, this._children[n] = {});
      }
      isDirected() {
        return this._isDirected;
      }
      isMultigraph() {
        return this._isMultigraph;
      }
      isCompound() {
        return this._isCompound;
      }
      setGraph(d) {
        return this._label = d, this;
      }
      graph() {
        return this._label;
      }
      setDefaultNodeLabel(d) {
        return this._defaultNodeLabelFn = d, typeof d != "function" && (this._defaultNodeLabelFn = () => d), this;
      }
      nodeCount() {
        return this._nodeCount;
      }
      nodes() {
        return Object.keys(this._nodes);
      }
      sources() {
        var d = this;
        return this.nodes().filter((h) => Object.keys(d._in[h]).length === 0);
      }
      sinks() {
        var d = this;
        return this.nodes().filter((h) => Object.keys(d._out[h]).length === 0);
      }
      setNodes(d, h) {
        var f = arguments, m = this;
        return d.forEach(function(p) {
          f.length > 1 ? m.setNode(p, h) : m.setNode(p);
        }), this;
      }
      setNode(d, h) {
        return Object.hasOwn(this._nodes, d) ? (arguments.length > 1 && (this._nodes[d] = h), this) : (this._nodes[d] = arguments.length > 1 ? h : this._defaultNodeLabelFn(d), this._isCompound && (this._parent[d] = n, this._children[d] = {}, this._children[n][d] = true), this._in[d] = {}, this._preds[d] = {}, this._out[d] = {}, this._sucs[d] = {}, ++this._nodeCount, this);
      }
      node(d) {
        return this._nodes[d];
      }
      hasNode(d) {
        return Object.hasOwn(this._nodes, d);
      }
      removeNode(d) {
        var h = this;
        if (Object.hasOwn(this._nodes, d)) {
          var f = (m) => h.removeEdge(h._edgeObjs[m]);
          delete this._nodes[d], this._isCompound && (this._removeFromParentsChildList(d), delete this._parent[d], this.children(d).forEach(function(m) {
            h.setParent(m);
          }), delete this._children[d]), Object.keys(this._in[d]).forEach(f), delete this._in[d], delete this._preds[d], Object.keys(this._out[d]).forEach(f), delete this._out[d], delete this._sucs[d], --this._nodeCount;
        }
        return this;
      }
      setParent(d, h) {
        if (!this._isCompound) throw new Error("Cannot set parent in a non-compound graph");
        if (h === void 0) h = n;
        else {
          h += "";
          for (var f = h; f !== void 0; f = this.parent(f)) if (f === d) throw new Error("Setting " + h + " as parent of " + d + " would create a cycle");
          this.setNode(h);
        }
        return this.setNode(d), this._removeFromParentsChildList(d), this._parent[d] = h, this._children[h][d] = true, this;
      }
      _removeFromParentsChildList(d) {
        delete this._children[this._parent[d]][d];
      }
      parent(d) {
        if (this._isCompound) {
          var h = this._parent[d];
          if (h !== n) return h;
        }
      }
      children(d = n) {
        if (this._isCompound) {
          var h = this._children[d];
          if (h) return Object.keys(h);
        } else {
          if (d === n) return this.nodes();
          if (this.hasNode(d)) return [];
        }
      }
      predecessors(d) {
        var h = this._preds[d];
        if (h) return Object.keys(h);
      }
      successors(d) {
        var h = this._sucs[d];
        if (h) return Object.keys(h);
      }
      neighbors(d) {
        var h = this.predecessors(d);
        if (h) {
          let m = new Set(h);
          for (var f of this.successors(d)) m.add(f);
          return Array.from(m.values());
        }
      }
      isLeaf(d) {
        var h;
        return this.isDirected() ? h = this.successors(d) : h = this.neighbors(d), h.length === 0;
      }
      filterNodes(d) {
        var h = new this.constructor({ directed: this._isDirected, multigraph: this._isMultigraph, compound: this._isCompound });
        h.setGraph(this.graph());
        var f = this;
        Object.entries(this._nodes).forEach(function([w, b]) {
          d(w) && h.setNode(w, b);
        }), Object.values(this._edgeObjs).forEach(function(w) {
          h.hasNode(w.v) && h.hasNode(w.w) && h.setEdge(w, f.edge(w));
        });
        var m = {};
        function p(w) {
          var b = f.parent(w);
          return b === void 0 || h.hasNode(b) ? (m[w] = b, b) : b in m ? m[b] : p(b);
        }
        return this._isCompound && h.nodes().forEach((w) => h.setParent(w, p(w))), h;
      }
      setDefaultEdgeLabel(d) {
        return this._defaultEdgeLabelFn = d, typeof d != "function" && (this._defaultEdgeLabelFn = () => d), this;
      }
      edgeCount() {
        return this._edgeCount;
      }
      edges() {
        return Object.values(this._edgeObjs);
      }
      setPath(d, h) {
        var f = this, m = arguments;
        return d.reduce(function(p, w) {
          return m.length > 1 ? f.setEdge(p, w, h) : f.setEdge(p, w), w;
        }), this;
      }
      setEdge() {
        var d, h, f, m, p = false, w = arguments[0];
        typeof w == "object" && w !== null && "v" in w ? (d = w.v, h = w.w, f = w.name, arguments.length === 2 && (m = arguments[1], p = true)) : (d = w, h = arguments[1], f = arguments[3], arguments.length > 2 && (m = arguments[2], p = true)), d = "" + d, h = "" + h, f !== void 0 && (f = "" + f);
        var b = l(this._isDirected, d, h, f);
        if (Object.hasOwn(this._edgeLabels, b)) return p && (this._edgeLabels[b] = m), this;
        if (f !== void 0 && !this._isMultigraph) throw new Error("Cannot set a named edge when isMultigraph = false");
        this.setNode(d), this.setNode(h), this._edgeLabels[b] = p ? m : this._defaultEdgeLabelFn(d, h, f);
        var g = u(this._isDirected, d, h, f);
        return d = g.v, h = g.w, Object.freeze(g), this._edgeObjs[b] = g, s(this._preds[h], d), s(this._sucs[d], h), this._in[h][b] = g, this._out[d][b] = g, this._edgeCount++, this;
      }
      edge(d, h, f) {
        var m = arguments.length === 1 ? c(this._isDirected, arguments[0]) : l(this._isDirected, d, h, f);
        return this._edgeLabels[m];
      }
      edgeAsObj() {
        let d = this.edge(...arguments);
        return typeof d != "object" ? { label: d } : d;
      }
      hasEdge(d, h, f) {
        var m = arguments.length === 1 ? c(this._isDirected, arguments[0]) : l(this._isDirected, d, h, f);
        return Object.hasOwn(this._edgeLabels, m);
      }
      removeEdge(d, h, f) {
        var m = arguments.length === 1 ? c(this._isDirected, arguments[0]) : l(this._isDirected, d, h, f), p = this._edgeObjs[m];
        return p && (d = p.v, h = p.w, delete this._edgeLabels[m], delete this._edgeObjs[m], a(this._preds[h], d), a(this._sucs[d], h), delete this._in[h][m], delete this._out[d][m], this._edgeCount--), this;
      }
      inEdges(d, h) {
        return this.isDirected() ? this.filterEdges(this._in[d], d, h) : this.nodeEdges(d, h);
      }
      outEdges(d, h) {
        return this.isDirected() ? this.filterEdges(this._out[d], d, h) : this.nodeEdges(d, h);
      }
      nodeEdges(d, h) {
        if (d in this._nodes) return this.filterEdges({ ...this._in[d], ...this._out[d] }, d, h);
      }
      filterEdges(d, h, f) {
        if (d) {
          var m = Object.values(d);
          return f ? m.filter(function(p) {
            return p.v === h && p.w === f || p.v === f && p.w === h;
          }) : m;
        }
      }
    };
    function s(d, h) {
      d[h] ? d[h]++ : d[h] = 1;
    }
    function a(d, h) {
      --d[h] || delete d[h];
    }
    function l(d, h, f, m) {
      var p = "" + h, w = "" + f;
      if (!d && p > w) {
        var b = p;
        p = w, w = b;
      }
      return p + i + w + i + (m === void 0 ? r : m);
    }
    function u(d, h, f, m) {
      var p = "" + h, w = "" + f;
      if (!d && p > w) {
        var b = p;
        p = w, w = b;
      }
      var g = { v: p, w };
      return m && (g.name = m), g;
    }
    function c(d, h) {
      return l(d, h.v, h.w, h.name);
    }
    t.exports = o;
  }), Yt = E((e, t) => {
    t.exports = "3.0.2";
  }), Bt = E((e, t) => {
    t.exports = { Graph: R(), version: Yt() };
  }), Wt = E((e, t) => {
    var r = R();
    t.exports = { write: n, read: s };
    function n(a) {
      var l = { options: { directed: a.isDirected(), multigraph: a.isMultigraph(), compound: a.isCompound() }, nodes: i(a), edges: o(a) };
      return a.graph() !== void 0 && (l.value = structuredClone(a.graph())), l;
    }
    function i(a) {
      return a.nodes().map(function(l) {
        var u = a.node(l), c = a.parent(l), d = { v: l };
        return u !== void 0 && (d.value = u), c !== void 0 && (d.parent = c), d;
      });
    }
    function o(a) {
      return a.edges().map(function(l) {
        var u = a.edge(l), c = { v: l.v, w: l.w };
        return l.name !== void 0 && (c.name = l.name), u !== void 0 && (c.value = u), c;
      });
    }
    function s(a) {
      var l = new r(a.options).setGraph(a.value);
      return a.nodes.forEach(function(u) {
        l.setNode(u.v, u.value), u.parent && l.setParent(u.v, u.parent);
      }), a.edges.forEach(function(u) {
        l.setEdge({ v: u.v, w: u.w, name: u.name }, u.value);
      }), l;
    }
  }), U = E((e, t) => {
    t.exports = n;
    var r = () => 1;
    function n(o, s, a, l) {
      return i(o, String(s), a || r, l || function(u) {
        return o.outEdges(u);
      });
    }
    function i(o, s, a, l) {
      var u = {}, c = true, d = 0, h = o.nodes(), f = function(b) {
        var g = a(b);
        u[b.v].distance + g < u[b.w].distance && (u[b.w] = { distance: u[b.v].distance + g, predecessor: b.v }, c = true);
      }, m = function() {
        h.forEach(function(b) {
          l(b).forEach(function(g) {
            var I = g.v === b ? g.v : g.w, Gt = I === g.v ? g.w : g.v;
            f({ v: I, w: Gt });
          });
        });
      };
      h.forEach(function(b) {
        var g = b === s ? 0 : Number.POSITIVE_INFINITY;
        u[b] = { distance: g };
      });
      for (var p = h.length, w = 1; w < p && (c = false, d++, m(), !!c); w++) ;
      if (d === p - 1 && (c = false, m(), c)) throw new Error("The graph contains a negative weight cycle");
      return u;
    }
  }), zt = E((e, t) => {
    t.exports = r;
    function r(n) {
      var i = {}, o = [], s;
      function a(l) {
        Object.hasOwn(i, l) || (i[l] = true, s.push(l), n.successors(l).forEach(a), n.predecessors(l).forEach(a));
      }
      return n.nodes().forEach(function(l) {
        s = [], a(l), s.length && o.push(s);
      }), o;
    }
  }), K = E((e, t) => {
    var r = class {
      constructor() {
        k(this, "_arr", []), k(this, "_keyIndices", {});
      }
      size() {
        return this._arr.length;
      }
      keys() {
        return this._arr.map(function(n) {
          return n.key;
        });
      }
      has(n) {
        return Object.hasOwn(this._keyIndices, n);
      }
      priority(n) {
        var i = this._keyIndices[n];
        if (i !== void 0) return this._arr[i].priority;
      }
      min() {
        if (this.size() === 0) throw new Error("Queue underflow");
        return this._arr[0].key;
      }
      add(n, i) {
        var o = this._keyIndices;
        if (n = String(n), !Object.hasOwn(o, n)) {
          var s = this._arr, a = s.length;
          return o[n] = a, s.push({ key: n, priority: i }), this._decrease(a), true;
        }
        return false;
      }
      removeMin() {
        this._swap(0, this._arr.length - 1);
        var n = this._arr.pop();
        return delete this._keyIndices[n.key], this._heapify(0), n.key;
      }
      decrease(n, i) {
        var o = this._keyIndices[n];
        if (i > this._arr[o].priority) throw new Error("New priority is greater than current priority. Key: " + n + " Old: " + this._arr[o].priority + " New: " + i);
        this._arr[o].priority = i, this._decrease(o);
      }
      _heapify(n) {
        var i = this._arr, o = 2 * n, s = o + 1, a = n;
        o < i.length && (a = i[o].priority < i[a].priority ? o : a, s < i.length && (a = i[s].priority < i[a].priority ? s : a), a !== n && (this._swap(n, a), this._heapify(a)));
      }
      _decrease(n) {
        for (var i = this._arr, o = i[n].priority, s; n !== 0 && (s = n >> 1, !(i[s].priority < o)); ) this._swap(n, s), n = s;
      }
      _swap(n, i) {
        var o = this._arr, s = this._keyIndices, a = o[n], l = o[i];
        o[n] = l, o[i] = a, s[l.key] = n, s[a.key] = i;
      }
    };
    t.exports = r;
  }), T = E((e, t) => {
    var r = K();
    t.exports = i;
    var n = () => 1;
    function i(s, a, l, u) {
      var c = function(d) {
        return s.outEdges(d);
      };
      return o(s, String(a), l || n, u || c);
    }
    function o(s, a, l, u) {
      var c = {}, d = new r(), h, f, m = function(p) {
        var w = p.v !== h ? p.v : p.w, b = c[w], g = l(p), I = f.distance + g;
        if (g < 0) throw new Error("dijkstra does not allow negative edge weights. Bad edge: " + p + " Weight: " + g);
        I < b.distance && (b.distance = I, b.predecessor = h, d.decrease(w, I));
      };
      for (s.nodes().forEach(function(p) {
        var w = p === a ? 0 : Number.POSITIVE_INFINITY;
        c[p] = { distance: w }, d.add(p, w);
      }); d.size() > 0 && (h = d.removeMin(), f = c[h], f.distance !== Number.POSITIVE_INFINITY); ) u(h).forEach(m);
      return c;
    }
  }), Xt = E((e, t) => {
    var r = T();
    t.exports = n;
    function n(i, o, s) {
      return i.nodes().reduce(function(a, l) {
        return a[l] = r(i, l, o, s), a;
      }, {});
    }
  }), Ht = E((e, t) => {
    t.exports = r;
    function r(i, o, s) {
      if (i[o].predecessor !== void 0) throw new Error("Invalid source vertex");
      if (i[s].predecessor === void 0 && s !== o) throw new Error("Invalid destination vertex");
      return { weight: i[s].distance, path: n(i, o, s) };
    }
    function n(i, o, s) {
      for (var a = [], l = s; l !== o; ) a.push(l), l = i[l].predecessor;
      return a.push(o), a.reverse();
    }
  }), Q = E((e, t) => {
    t.exports = r;
    function r(n) {
      var i = 0, o = [], s = {}, a = [];
      function l(u) {
        var c = s[u] = { onStack: true, lowlink: i, index: i++ };
        if (o.push(u), n.successors(u).forEach(function(f) {
          Object.hasOwn(s, f) ? s[f].onStack && (c.lowlink = Math.min(c.lowlink, s[f].index)) : (l(f), c.lowlink = Math.min(c.lowlink, s[f].lowlink));
        }), c.lowlink === c.index) {
          var d = [], h;
          do
            h = o.pop(), s[h].onStack = false, d.push(h);
          while (u !== h);
          a.push(d);
        }
      }
      return n.nodes().forEach(function(u) {
        Object.hasOwn(s, u) || l(u);
      }), a;
    }
  }), Ut = E((e, t) => {
    var r = Q();
    t.exports = n;
    function n(i) {
      return r(i).filter(function(o) {
        return o.length > 1 || o.length === 1 && i.hasEdge(o[0], o[0]);
      });
    }
  }), Kt = E((e, t) => {
    t.exports = n;
    var r = () => 1;
    function n(o, s, a) {
      return i(o, s || r, a || function(l) {
        return o.outEdges(l);
      });
    }
    function i(o, s, a) {
      var l = {}, u = o.nodes();
      return u.forEach(function(c) {
        l[c] = {}, l[c][c] = { distance: 0 }, u.forEach(function(d) {
          c !== d && (l[c][d] = { distance: Number.POSITIVE_INFINITY });
        }), a(c).forEach(function(d) {
          var h = d.v === c ? d.w : d.v, f = s(d);
          l[c][h] = { distance: f, predecessor: c };
        });
      }), u.forEach(function(c) {
        var d = l[c];
        u.forEach(function(h) {
          var f = l[h];
          u.forEach(function(m) {
            var p = f[c], w = d[m], b = f[m], g = p.distance + w.distance;
            g < b.distance && (b.distance = g, b.predecessor = w.predecessor);
          });
        });
      }), l;
    }
  }), J = E((e, t) => {
    function r(i) {
      var o = {}, s = {}, a = [];
      function l(u) {
        if (Object.hasOwn(s, u)) throw new n();
        Object.hasOwn(o, u) || (s[u] = true, o[u] = true, i.predecessors(u).forEach(l), delete s[u], a.push(u));
      }
      if (i.sinks().forEach(l), Object.keys(o).length !== i.nodeCount()) throw new n();
      return a;
    }
    var n = class extends Error {
      constructor() {
        super(...arguments);
      }
    };
    t.exports = r, r.CycleException = n;
  }), Qt = E((e, t) => {
    var r = J();
    t.exports = n;
    function n(i) {
      try {
        r(i);
      } catch (o) {
        if (o instanceof r.CycleException) return false;
        throw o;
      }
      return true;
    }
  }), Z = E((e, t) => {
    t.exports = r;
    function r(i, o, s, a, l) {
      Array.isArray(o) || (o = [o]);
      var u = (i.isDirected() ? i.successors : i.neighbors).bind(i), c = {};
      return o.forEach(function(d) {
        if (!i.hasNode(d)) throw new Error("Graph does not have node: " + d);
        l = n(i, d, s === "post", c, u, a, l);
      }), l;
    }
    function n(i, o, s, a, l, u, c) {
      return Object.hasOwn(a, o) || (a[o] = true, s || (c = u(c, o)), l(o).forEach(function(d) {
        c = n(i, d, s, a, l, u, c);
      }), s && (c = u(c, o))), c;
    }
  }), $ = E((e, t) => {
    var r = Z();
    t.exports = n;
    function n(i, o, s) {
      return r(i, o, s, function(a, l) {
        return a.push(l), a;
      }, []);
    }
  }), Jt = E((e, t) => {
    var r = $();
    t.exports = n;
    function n(i, o) {
      return r(i, o, "post");
    }
  }), Zt = E((e, t) => {
    var r = $();
    t.exports = n;
    function n(i, o) {
      return r(i, o, "pre");
    }
  }), $t = E((e, t) => {
    var r = R(), n = K();
    t.exports = i;
    function i(o, s) {
      var a = new r(), l = {}, u = new n(), c;
      function d(f) {
        var m = f.v === c ? f.w : f.v, p = u.priority(m);
        if (p !== void 0) {
          var w = s(f);
          w < p && (l[m] = c, u.decrease(m, w));
        }
      }
      if (o.nodeCount() === 0) return a;
      o.nodes().forEach(function(f) {
        u.add(f, Number.POSITIVE_INFINITY), a.setNode(f);
      }), u.decrease(o.nodes()[0], 0);
      for (var h = false; u.size() > 0; ) {
        if (c = u.removeMin(), Object.hasOwn(l, c)) a.setEdge(c, l[c]);
        else {
          if (h) throw new Error("Input graph is not connected: " + o);
          h = true;
        }
        o.nodeEdges(c).forEach(d);
      }
      return a;
    }
  }), er = E((e, t) => {
    var r = T(), n = U();
    t.exports = i;
    function i(s, a, l, u) {
      return o(s, a, l, u || function(c) {
        return s.outEdges(c);
      });
    }
    function o(s, a, l, u) {
      if (l === void 0) return r(s, a, l, u);
      for (var c = false, d = s.nodes(), h = 0; h < d.length; h++) {
        for (var f = u(d[h]), m = 0; m < f.length; m++) {
          var p = f[m], w = p.v === d[h] ? p.v : p.w, b = w === p.v ? p.w : p.v;
          l({ v: w, w: b }) < 0 && (c = true);
        }
        if (c) return n(s, a, l, u);
      }
      return r(s, a, l, u);
    }
  }), tr = E((e, t) => {
    t.exports = { bellmanFord: U(), components: zt(), dijkstra: T(), dijkstraAll: Xt(), extractPath: Ht(), findCycles: Ut(), floydWarshall: Kt(), isAcyclic: Qt(), postorder: Jt(), preorder: Zt(), prim: $t(), shortestPaths: er(), reduce: Z(), tarjan: Q(), topsort: J() };
  }), H = Bt();
  ee.exports = { Graph: H.Graph, json: Wt(), alg: tr(), version: H.version };
});
var ne = v((Ai, re) => {
  var S = class {
    constructor() {
      let t = {};
      t._next = t._prev = t, this._sentinel = t;
    }
    dequeue() {
      let t = this._sentinel, r = t._prev;
      if (r !== t) return te(r), r;
    }
    enqueue(t) {
      let r = this._sentinel;
      t._prev && t._next && te(t), t._next = r._next, r._next._prev = t, r._next = t, t._prev = r;
    }
    toString() {
      let t = [], r = this._sentinel, n = r._prev;
      for (; n !== r; ) t.push(JSON.stringify(n, rr)), n = n._prev;
      return "[" + t.join(", ") + "]";
    }
  };
  function te(e) {
    e._prev._next = e._next, e._next._prev = e._prev, delete e._next, delete e._prev;
  }
  function rr(e, t) {
    if (e !== "_next" && e !== "_prev") return t;
  }
  re.exports = S;
});
var oe = v((Yi, ie) => {
  var nr = y().Graph, ir = ne();
  ie.exports = sr;
  var or = () => 1;
  function sr(e, t) {
    if (e.nodeCount() <= 1) return [];
    let r = dr(e, t || or);
    return ar(r.graph, r.buckets, r.zeroIdx).flatMap((i) => e.outEdges(i.v, i.w));
  }
  function ar(e, t, r) {
    let n = [], i = t[t.length - 1], o = t[0], s;
    for (; e.nodeCount(); ) {
      for (; s = o.dequeue(); ) P(e, t, r, s);
      for (; s = i.dequeue(); ) P(e, t, r, s);
      if (e.nodeCount()) {
        for (let a = t.length - 2; a > 0; --a) if (s = t[a].dequeue(), s) {
          n = n.concat(P(e, t, r, s, true));
          break;
        }
      }
    }
    return n;
  }
  function P(e, t, r, n, i) {
    let o = i ? [] : void 0;
    return e.inEdges(n.v).forEach((s) => {
      let a = e.edge(s), l = e.node(s.v);
      i && o.push({ v: s.v, w: s.w }), l.out -= a, F(t, r, l);
    }), e.outEdges(n.v).forEach((s) => {
      let a = e.edge(s), l = s.w, u = e.node(l);
      u.in -= a, F(t, r, u);
    }), e.removeNode(n.v), o;
  }
  function dr(e, t) {
    let r = new nr(), n = 0, i = 0;
    e.nodes().forEach((a) => {
      r.setNode(a, { v: a, in: 0, out: 0 });
    }), e.edges().forEach((a) => {
      let l = r.edge(a.v, a.w) || 0, u = t(a), c = l + u;
      r.setEdge(a.v, a.w, c), i = Math.max(i, r.node(a.v).out += u), n = Math.max(n, r.node(a.w).in += u);
    });
    let o = lr(i + n + 3).map(() => new ir()), s = n + 1;
    return r.nodes().forEach((a) => {
      F(o, s, r.node(a));
    }), { graph: r, buckets: o, zeroIdx: s };
  }
  function F(e, t, r) {
    r.out ? r.in ? e[r.out - r.in + t].enqueue(r) : e[e.length - 1].enqueue(r) : e[0].enqueue(r);
  }
  function lr(e) {
    let t = [];
    for (let r = 0; r < e; r++) t.push(r);
    return t;
  }
});
var _ = v((Bi, ce) => {
  "use strict";
  var se = y().Graph;
  ce.exports = { addBorderNode: vr, addDummyNode: ae, applyWithChunking: C, asNonCompoundGraph: hr, buildLayerMatrix: mr, intersectRect: pr, mapValues: Or, maxRank: le, normalizeRanks: wr, notime: kr, partition: Er, pick: xr, predecessorWeights: fr, range: he, removeEmptyRanks: br, simplify: ur, successorWeights: cr, time: _r, uniqueId: ue, zipObject: D };
  function ae(e, t, r, n) {
    for (var i = n; e.hasNode(i); ) i = ue(n);
    return r.dummy = t, e.setNode(i, r), i;
  }
  function ur(e) {
    let t = new se().setGraph(e.graph());
    return e.nodes().forEach((r) => t.setNode(r, e.node(r))), e.edges().forEach((r) => {
      let n = t.edge(r.v, r.w) || { weight: 0, minlen: 1 }, i = e.edge(r);
      t.setEdge(r.v, r.w, { weight: n.weight + i.weight, minlen: Math.max(n.minlen, i.minlen) });
    }), t;
  }
  function hr(e) {
    let t = new se({ multigraph: e.isMultigraph() }).setGraph(e.graph());
    return e.nodes().forEach((r) => {
      e.children(r).length || t.setNode(r, e.node(r));
    }), e.edges().forEach((r) => {
      t.setEdge(r, e.edge(r));
    }), t;
  }
  function cr(e) {
    let t = e.nodes().map((r) => {
      let n = {};
      return e.outEdges(r).forEach((i) => {
        n[i.w] = (n[i.w] || 0) + e.edge(i).weight;
      }), n;
    });
    return D(e.nodes(), t);
  }
  function fr(e) {
    let t = e.nodes().map((r) => {
      let n = {};
      return e.inEdges(r).forEach((i) => {
        n[i.v] = (n[i.v] || 0) + e.edge(i).weight;
      }), n;
    });
    return D(e.nodes(), t);
  }
  function pr(e, t) {
    let r = e.x, n = e.y, i = t.x - r, o = t.y - n, s = e.width / 2, a = e.height / 2;
    if (!i && !o) throw new Error("Not possible to find intersection inside of the rectangle");
    let l, u;
    return Math.abs(o) * s > Math.abs(i) * a ? (o < 0 && (a = -a), l = a * i / o, u = a) : (i < 0 && (s = -s), l = s, u = s * o / i), { x: r + l, y: n + u };
  }
  function mr(e) {
    let t = he(le(e) + 1).map(() => []);
    return e.nodes().forEach((r) => {
      let n = e.node(r), i = n.rank;
      i !== void 0 && (t[i][n.order] = r);
    }), t;
  }
  function wr(e) {
    let t = e.nodes().map((n) => {
      let i = e.node(n).rank;
      return i === void 0 ? Number.MAX_VALUE : i;
    }), r = C(Math.min, t);
    e.nodes().forEach((n) => {
      let i = e.node(n);
      Object.hasOwn(i, "rank") && (i.rank -= r);
    });
  }
  function br(e) {
    let t = e.nodes().map((s) => e.node(s).rank).filter((s) => s !== void 0), r = C(Math.min, t), n = [];
    e.nodes().forEach((s) => {
      let a = e.node(s).rank - r;
      n[a] || (n[a] = []), n[a].push(s);
    });
    let i = 0, o = e.graph().nodeRankFactor;
    Array.from(n).forEach((s, a) => {
      s === void 0 && a % o !== 0 ? --i : s !== void 0 && i && s.forEach((l) => e.node(l).rank += i);
    });
  }
  function vr(e, t, r, n) {
    let i = { width: 0, height: 0 };
    return arguments.length >= 4 && (i.rank = r, i.order = n), ae(e, "border", i, t);
  }
  function gr(e, t = de) {
    let r = [];
    for (let n = 0; n < e.length; n += t) {
      let i = e.slice(n, n + t);
      r.push(i);
    }
    return r;
  }
  var de = 65535;
  function C(e, t) {
    if (t.length > de) {
      let r = gr(t);
      return e.apply(null, r.map((n) => e.apply(null, n)));
    } else return e.apply(null, t);
  }
  function le(e) {
    let r = e.nodes().map((n) => {
      let i = e.node(n).rank;
      return i === void 0 ? Number.MIN_VALUE : i;
    });
    return C(Math.max, r);
  }
  function Er(e, t) {
    let r = { lhs: [], rhs: [] };
    return e.forEach((n) => {
      t(n) ? r.lhs.push(n) : r.rhs.push(n);
    }), r;
  }
  function _r(e, t) {
    let r = Date.now();
    try {
      return t();
    } finally {
      console.log(e + " time: " + (Date.now() - r) + "ms");
    }
  }
  function kr(e, t) {
    return t();
  }
  var yr = 0;
  function ue(e) {
    var t = ++yr;
    return e + ("" + t);
  }
  function he(e, t, r = 1) {
    t == null && (t = e, e = 0);
    let n = (o) => o < t;
    r < 0 && (n = (o) => t < o);
    let i = [];
    for (let o = e; n(o); o += r) i.push(o);
    return i;
  }
  function xr(e, t) {
    let r = {};
    for (let n of t) e[n] !== void 0 && (r[n] = e[n]);
    return r;
  }
  function Or(e, t) {
    let r = t;
    return typeof t == "string" && (r = (n) => n[t]), Object.entries(e).reduce((n, [i, o]) => (n[i] = r(o, i), n), {});
  }
  function D(e, t) {
    return e.reduce((r, n, i) => (r[n] = t[i], r), {});
  }
});
var pe = v((Wi, fe) => {
  "use strict";
  var Nr = oe(), Ir = _().uniqueId;
  fe.exports = { run: jr, undo: Lr };
  function jr(e) {
    (e.graph().acyclicer === "greedy" ? Nr(e, r(e)) : Cr(e)).forEach((n) => {
      let i = e.edge(n);
      e.removeEdge(n), i.forwardName = n.name, i.reversed = true, e.setEdge(n.w, n.v, i, Ir("rev"));
    });
    function r(n) {
      return (i) => n.edge(i).weight;
    }
  }
  function Cr(e) {
    let t = [], r = {}, n = {};
    function i(o) {
      Object.hasOwn(n, o) || (n[o] = true, r[o] = true, e.outEdges(o).forEach((s) => {
        Object.hasOwn(r, s.w) ? t.push(s) : i(s.w);
      }), delete r[o]);
    }
    return e.nodes().forEach(i), t;
  }
  function Lr(e) {
    e.edges().forEach((t) => {
      let r = e.edge(t);
      if (r.reversed) {
        e.removeEdge(t);
        let n = r.forwardName;
        delete r.reversed, delete r.forwardName, e.setEdge(t.w, t.v, r, n);
      }
    });
  }
});
var we = v((zi, me) => {
  "use strict";
  var qr = _();
  me.exports = { run: Mr, undo: Tr };
  function Mr(e) {
    e.graph().dummyChains = [], e.edges().forEach((t) => Rr(e, t));
  }
  function Rr(e, t) {
    let r = t.v, n = e.node(r).rank, i = t.w, o = e.node(i).rank, s = t.name, a = e.edge(t), l = a.labelRank;
    if (o === n + 1) return;
    e.removeEdge(t);
    let u, c, d;
    for (d = 0, ++n; n < o; ++d, ++n) a.points = [], c = { width: 0, height: 0, edgeLabel: a, edgeObj: t, rank: n }, u = qr.addDummyNode(e, "edge", c, "_d"), n === l && (c.width = a.width, c.height = a.height, c.dummy = "edge-label", c.labelpos = a.labelpos), e.setEdge(r, u, { weight: a.weight }, s), d === 0 && e.graph().dummyChains.push(u), r = u;
    e.setEdge(r, i, { weight: a.weight }, s);
  }
  function Tr(e) {
    e.graph().dummyChains.forEach((t) => {
      let r = e.node(t), n = r.edgeLabel, i;
      for (e.setEdge(r.edgeObj, n); r.dummy; ) i = e.successors(t)[0], e.removeNode(t), n.points.push({ x: r.x, y: r.y }), r.dummy === "edge-label" && (n.x = r.x, n.y = r.y, n.width = r.width, n.height = r.height), t = i, r = e.node(t);
    });
  }
});
var j = v((Xi, be) => {
  "use strict";
  var { applyWithChunking: Sr } = _();
  be.exports = { longestPath: Pr, slack: Fr };
  function Pr(e) {
    var t = {};
    function r(n) {
      var i = e.node(n);
      if (Object.hasOwn(t, n)) return i.rank;
      t[n] = true;
      let o = e.outEdges(n).map((a) => a == null ? Number.POSITIVE_INFINITY : r(a.w) - e.edge(a).minlen);
      var s = Sr(Math.min, o);
      return s === Number.POSITIVE_INFINITY && (s = 0), i.rank = s;
    }
    e.sources().forEach(r);
  }
  function Fr(e, t) {
    return e.node(t.w).rank - e.node(t.v).rank - e.edge(t).minlen;
  }
});
var G = v((Hi, ve) => {
  "use strict";
  var Dr = y().Graph, L = j().slack;
  ve.exports = Gr;
  function Gr(e) {
    var t = new Dr({ directed: false }), r = e.nodes()[0], n = e.nodeCount();
    t.setNode(r, {});
    for (var i, o; Vr(t, e) < n; ) i = Ar(t, e), o = t.hasNode(i.v) ? L(e, i) : -L(e, i), Yr(t, e, o);
    return t;
  }
  function Vr(e, t) {
    function r(n) {
      t.nodeEdges(n).forEach((i) => {
        var o = i.v, s = n === o ? i.w : o;
        !e.hasNode(s) && !L(t, i) && (e.setNode(s, {}), e.setEdge(n, s, {}), r(s));
      });
    }
    return e.nodes().forEach(r), e.nodeCount();
  }
  function Ar(e, t) {
    return t.edges().reduce((n, i) => {
      let o = Number.POSITIVE_INFINITY;
      return e.hasNode(i.v) !== e.hasNode(i.w) && (o = L(t, i)), o < n[0] ? [o, i] : n;
    }, [Number.POSITIVE_INFINITY, null])[1];
  }
  function Yr(e, t, r) {
    e.nodes().forEach((n) => t.node(n).rank += r);
  }
});
var Ie = v((Ui, Ne) => {
  "use strict";
  var Br = G(), ge = j().slack, Wr = j().longestPath, zr = y().alg.preorder, Xr = y().alg.postorder, Hr = _().simplify;
  Ne.exports = N;
  N.initLowLimValues = A;
  N.initCutValues = V;
  N.calcCutValue = _e;
  N.leaveEdge = ye;
  N.enterEdge = xe;
  N.exchangeEdges = Oe;
  function N(e) {
    e = Hr(e), Wr(e);
    var t = Br(e);
    A(t), V(t, e);
    for (var r, n; r = ye(t); ) n = xe(t, e, r), Oe(t, e, r, n);
  }
  function V(e, t) {
    var r = Xr(e, e.nodes());
    r = r.slice(0, r.length - 1), r.forEach((n) => Ur(e, t, n));
  }
  function Ur(e, t, r) {
    var n = e.node(r), i = n.parent;
    e.edge(r, i).cutvalue = _e(e, t, r);
  }
  function _e(e, t, r) {
    var n = e.node(r), i = n.parent, o = true, s = t.edge(r, i), a = 0;
    return s || (o = false, s = t.edge(i, r)), a = s.weight, t.nodeEdges(r).forEach((l) => {
      var u = l.v === r, c = u ? l.w : l.v;
      if (c !== i) {
        var d = u === o, h = t.edge(l).weight;
        if (a += d ? h : -h, Qr(e, r, c)) {
          var f = e.edge(r, c).cutvalue;
          a += d ? -f : f;
        }
      }
    }), a;
  }
  function A(e, t) {
    arguments.length < 2 && (t = e.nodes()[0]), ke(e, {}, 1, t);
  }
  function ke(e, t, r, n, i) {
    var o = r, s = e.node(n);
    return t[n] = true, e.neighbors(n).forEach((a) => {
      Object.hasOwn(t, a) || (r = ke(e, t, r, a, n));
    }), s.low = o, s.lim = r++, i ? s.parent = i : delete s.parent, r;
  }
  function ye(e) {
    return e.edges().find((t) => e.edge(t).cutvalue < 0);
  }
  function xe(e, t, r) {
    var n = r.v, i = r.w;
    t.hasEdge(n, i) || (n = r.w, i = r.v);
    var o = e.node(n), s = e.node(i), a = o, l = false;
    o.lim > s.lim && (a = s, l = true);
    var u = t.edges().filter((c) => l === Ee(e, e.node(c.v), a) && l !== Ee(e, e.node(c.w), a));
    return u.reduce((c, d) => ge(t, d) < ge(t, c) ? d : c);
  }
  function Oe(e, t, r, n) {
    var i = r.v, o = r.w;
    e.removeEdge(i, o), e.setEdge(n.v, n.w, {}), A(e), V(e, t), Kr(e, t);
  }
  function Kr(e, t) {
    var r = e.nodes().find((i) => !t.node(i).parent), n = zr(e, r);
    n = n.slice(1), n.forEach((i) => {
      var o = e.node(i).parent, s = t.edge(i, o), a = false;
      s || (s = t.edge(o, i), a = true), t.node(i).rank = t.node(o).rank + (a ? s.minlen : -s.minlen);
    });
  }
  function Qr(e, t, r) {
    return e.hasEdge(t, r);
  }
  function Ee(e, t, r) {
    return r.low <= t.lim && t.lim <= r.lim;
  }
});
var qe = v((Ki, Le) => {
  "use strict";
  var Jr = j(), Ce = Jr.longestPath, Zr = G(), $r = Ie();
  Le.exports = en;
  function en(e) {
    var t = e.graph().ranker;
    if (t instanceof Function) return t(e);
    switch (e.graph().ranker) {
      case "network-simplex":
        je(e);
        break;
      case "tight-tree":
        rn(e);
        break;
      case "longest-path":
        tn(e);
        break;
      case "none":
        break;
      default:
        je(e);
    }
  }
  var tn = Ce;
  function rn(e) {
    Ce(e), Zr(e);
  }
  function je(e) {
    $r(e);
  }
});
var Re = v((Qi, Me) => {
  Me.exports = nn;
  function nn(e) {
    let t = sn(e);
    e.graph().dummyChains.forEach((r) => {
      let n = e.node(r), i = n.edgeObj, o = on(e, t, i.v, i.w), s = o.path, a = o.lca, l = 0, u = s[l], c = true;
      for (; r !== i.w; ) {
        if (n = e.node(r), c) {
          for (; (u = s[l]) !== a && e.node(u).maxRank < n.rank; ) l++;
          u === a && (c = false);
        }
        if (!c) {
          for (; l < s.length - 1 && e.node(u = s[l + 1]).minRank <= n.rank; ) l++;
          u = s[l];
        }
        e.setParent(r, u), r = e.successors(r)[0];
      }
    });
  }
  function on(e, t, r, n) {
    let i = [], o = [], s = Math.min(t[r].low, t[n].low), a = Math.max(t[r].lim, t[n].lim), l, u;
    l = r;
    do
      l = e.parent(l), i.push(l);
    while (l && (t[l].low > s || a > t[l].lim));
    for (u = l, l = n; (l = e.parent(l)) !== u; ) o.push(l);
    return { path: i.concat(o.reverse()), lca: u };
  }
  function sn(e) {
    let t = {}, r = 0;
    function n(i) {
      let o = r;
      e.children(i).forEach(n), t[i] = { low: o, lim: r++ };
    }
    return e.children().forEach(n), t;
  }
});
var Pe = v((Ji, Se) => {
  var q = _();
  Se.exports = { run: an, cleanup: un };
  function an(e) {
    let t = q.addDummyNode(e, "root", {}, "_root"), r = dn(e), n = Object.values(r), i = q.applyWithChunking(Math.max, n) - 1, o = 2 * i + 1;
    e.graph().nestingRoot = t, e.edges().forEach((a) => e.edge(a).minlen *= o);
    let s = ln(e) + 1;
    e.children().forEach((a) => Te(e, t, o, s, i, r, a)), e.graph().nodeRankFactor = o;
  }
  function Te(e, t, r, n, i, o, s) {
    let a = e.children(s);
    if (!a.length) {
      s !== t && e.setEdge(t, s, { weight: 0, minlen: r });
      return;
    }
    let l = q.addBorderNode(e, "_bt"), u = q.addBorderNode(e, "_bb"), c = e.node(s);
    e.setParent(l, s), c.borderTop = l, e.setParent(u, s), c.borderBottom = u, a.forEach((d) => {
      Te(e, t, r, n, i, o, d);
      let h = e.node(d), f = h.borderTop ? h.borderTop : d, m = h.borderBottom ? h.borderBottom : d, p = h.borderTop ? n : 2 * n, w = f !== m ? 1 : i - o[s] + 1;
      e.setEdge(l, f, { weight: p, minlen: w, nestingEdge: true }), e.setEdge(m, u, { weight: p, minlen: w, nestingEdge: true });
    }), e.parent(s) || e.setEdge(t, l, { weight: 0, minlen: i + o[s] });
  }
  function dn(e) {
    var t = {};
    function r(n, i) {
      var o = e.children(n);
      o && o.length && o.forEach((s) => r(s, i + 1)), t[n] = i;
    }
    return e.children().forEach((n) => r(n, 1)), t;
  }
  function ln(e) {
    return e.edges().reduce((t, r) => t + e.edge(r).weight, 0);
  }
  function un(e) {
    var t = e.graph();
    e.removeNode(t.nestingRoot), delete t.nestingRoot, e.edges().forEach((r) => {
      var n = e.edge(r);
      n.nestingEdge && e.removeEdge(r);
    });
  }
});
var Ge = v((Zi, De) => {
  var hn = _();
  De.exports = cn;
  function cn(e) {
    function t(r) {
      let n = e.children(r), i = e.node(r);
      if (n.length && n.forEach(t), Object.hasOwn(i, "minRank")) {
        i.borderLeft = [], i.borderRight = [];
        for (let o = i.minRank, s = i.maxRank + 1; o < s; ++o) Fe(e, "borderLeft", "_bl", r, i, o), Fe(e, "borderRight", "_br", r, i, o);
      }
    }
    e.children().forEach(t);
  }
  function Fe(e, t, r, n, i, o) {
    let s = { width: 0, height: 0, rank: o, borderType: t }, a = i[t][o - 1], l = hn.addDummyNode(e, "border", s, r);
    i[t][o] = l, e.setParent(l, n), a && e.setEdge(a, l, { weight: 1 });
  }
});
var Be = v(($i, Ye) => {
  "use strict";
  Ye.exports = { adjust: fn, undo: pn };
  function fn(e) {
    let t = e.graph().rankdir.toLowerCase();
    (t === "lr" || t === "rl") && Ae(e);
  }
  function pn(e) {
    let t = e.graph().rankdir.toLowerCase();
    (t === "bt" || t === "rl") && mn(e), (t === "lr" || t === "rl") && (wn(e), Ae(e));
  }
  function Ae(e) {
    e.nodes().forEach((t) => Ve(e.node(t))), e.edges().forEach((t) => Ve(e.edge(t)));
  }
  function Ve(e) {
    let t = e.width;
    e.width = e.height, e.height = t;
  }
  function mn(e) {
    e.nodes().forEach((t) => Y(e.node(t))), e.edges().forEach((t) => {
      let r = e.edge(t);
      r.points.forEach(Y), Object.hasOwn(r, "y") && Y(r);
    });
  }
  function Y(e) {
    e.y = -e.y;
  }
  function wn(e) {
    e.nodes().forEach((t) => B(e.node(t))), e.edges().forEach((t) => {
      let r = e.edge(t);
      r.points.forEach(B), Object.hasOwn(r, "x") && B(r);
    });
  }
  function B(e) {
    let t = e.x;
    e.x = e.y, e.y = t;
  }
});
var Xe = v((eo, ze) => {
  "use strict";
  var We = _();
  ze.exports = bn;
  function bn(e) {
    let t = {}, r = e.nodes().filter((l) => !e.children(l).length), n = r.map((l) => e.node(l).rank), i = We.applyWithChunking(Math.max, n), o = We.range(i + 1).map(() => []);
    function s(l) {
      if (t[l]) return;
      t[l] = true;
      let u = e.node(l);
      o[u.rank].push(l), e.successors(l).forEach(s);
    }
    return r.sort((l, u) => e.node(l).rank - e.node(u).rank).forEach(s), o;
  }
});
var Ue = v((to, He) => {
  "use strict";
  var vn = _().zipObject;
  He.exports = gn;
  function gn(e, t) {
    let r = 0;
    for (let n = 1; n < t.length; ++n) r += En(e, t[n - 1], t[n]);
    return r;
  }
  function En(e, t, r) {
    let n = vn(r, r.map((u, c) => c)), i = t.flatMap((u) => e.outEdges(u).map((c) => ({ pos: n[c.w], weight: e.edge(c).weight })).sort((c, d) => c.pos - d.pos)), o = 1;
    for (; o < r.length; ) o <<= 1;
    let s = 2 * o - 1;
    o -= 1;
    let a = new Array(s).fill(0), l = 0;
    return i.forEach((u) => {
      let c = u.pos + o;
      a[c] += u.weight;
      let d = 0;
      for (; c > 0; ) c % 2 && (d += a[c + 1]), c = c - 1 >> 1, a[c] += u.weight;
      l += u.weight * d;
    }), l;
  }
});
var Qe = v((ro, Ke) => {
  Ke.exports = _n;
  function _n(e, t = []) {
    return t.map((r) => {
      let n = e.inEdges(r);
      if (n.length) {
        let i = n.reduce((o, s) => {
          let a = e.edge(s), l = e.node(s.v);
          return { sum: o.sum + a.weight * l.order, weight: o.weight + a.weight };
        }, { sum: 0, weight: 0 });
        return { v: r, barycenter: i.sum / i.weight, weight: i.weight };
      } else return { v: r };
    });
  }
});
var Ze = v((no, Je) => {
  "use strict";
  var kn = _();
  Je.exports = yn;
  function yn(e, t) {
    let r = {};
    e.forEach((i, o) => {
      let s = r[i.v] = { indegree: 0, in: [], out: [], vs: [i.v], i: o };
      i.barycenter !== void 0 && (s.barycenter = i.barycenter, s.weight = i.weight);
    }), t.edges().forEach((i) => {
      let o = r[i.v], s = r[i.w];
      o !== void 0 && s !== void 0 && (s.indegree++, o.out.push(r[i.w]));
    });
    let n = Object.values(r).filter((i) => !i.indegree);
    return xn(n);
  }
  function xn(e) {
    let t = [];
    function r(i) {
      return (o) => {
        o.merged || (o.barycenter === void 0 || i.barycenter === void 0 || o.barycenter >= i.barycenter) && On(i, o);
      };
    }
    function n(i) {
      return (o) => {
        o.in.push(i), --o.indegree === 0 && e.push(o);
      };
    }
    for (; e.length; ) {
      let i = e.pop();
      t.push(i), i.in.reverse().forEach(r(i)), i.out.forEach(n(i));
    }
    return t.filter((i) => !i.merged).map((i) => kn.pick(i, ["vs", "i", "barycenter", "weight"]));
  }
  function On(e, t) {
    let r = 0, n = 0;
    e.weight && (r += e.barycenter * e.weight, n += e.weight), t.weight && (r += t.barycenter * t.weight, n += t.weight), e.vs = t.vs.concat(e.vs), e.barycenter = r / n, e.weight = n, e.i = Math.min(t.i, e.i), t.merged = true;
  }
});
var tt = v((io, et) => {
  var Nn = _();
  et.exports = In;
  function In(e, t) {
    let r = Nn.partition(e, (c) => Object.hasOwn(c, "barycenter")), n = r.lhs, i = r.rhs.sort((c, d) => d.i - c.i), o = [], s = 0, a = 0, l = 0;
    n.sort(jn(!!t)), l = $e(o, i, l), n.forEach((c) => {
      l += c.vs.length, o.push(c.vs), s += c.barycenter * c.weight, a += c.weight, l = $e(o, i, l);
    });
    let u = { vs: o.flat(true) };
    return a && (u.barycenter = s / a, u.weight = a), u;
  }
  function $e(e, t, r) {
    let n;
    for (; t.length && (n = t[t.length - 1]).i <= r; ) t.pop(), e.push(n.vs), r++;
    return r;
  }
  function jn(e) {
    return (t, r) => t.barycenter < r.barycenter ? -1 : t.barycenter > r.barycenter ? 1 : e ? r.i - t.i : t.i - r.i;
  }
});
var it = v((oo, nt) => {
  var Cn = Qe(), Ln = Ze(), qn = tt();
  nt.exports = rt;
  function rt(e, t, r, n) {
    let i = e.children(t), o = e.node(t), s = o ? o.borderLeft : void 0, a = o ? o.borderRight : void 0, l = {};
    s && (i = i.filter((h) => h !== s && h !== a));
    let u = Cn(e, i);
    u.forEach((h) => {
      if (e.children(h.v).length) {
        let f = rt(e, h.v, r, n);
        l[h.v] = f, Object.hasOwn(f, "barycenter") && Rn(h, f);
      }
    });
    let c = Ln(u, r);
    Mn(c, l);
    let d = qn(c, n);
    if (s && (d.vs = [s, d.vs, a].flat(true), e.predecessors(s).length)) {
      let h = e.node(e.predecessors(s)[0]), f = e.node(e.predecessors(a)[0]);
      Object.hasOwn(d, "barycenter") || (d.barycenter = 0, d.weight = 0), d.barycenter = (d.barycenter * d.weight + h.order + f.order) / (d.weight + 2), d.weight += 2;
    }
    return d;
  }
  function Mn(e, t) {
    e.forEach((r) => {
      r.vs = r.vs.flatMap((n) => t[n] ? t[n].vs : n);
    });
  }
  function Rn(e, t) {
    e.barycenter !== void 0 ? (e.barycenter = (e.barycenter * e.weight + t.barycenter * t.weight) / (e.weight + t.weight), e.weight += t.weight) : (e.barycenter = t.barycenter, e.weight = t.weight);
  }
});
var st = v((so, ot) => {
  var Tn = y().Graph, Sn = _();
  ot.exports = Pn;
  function Pn(e, t, r, n) {
    n || (n = e.nodes());
    let i = Fn(e), o = new Tn({ compound: true }).setGraph({ root: i }).setDefaultNodeLabel((s) => e.node(s));
    return n.forEach((s) => {
      let a = e.node(s), l = e.parent(s);
      (a.rank === t || a.minRank <= t && t <= a.maxRank) && (o.setNode(s), o.setParent(s, l || i), e[r](s).forEach((u) => {
        let c = u.v === s ? u.w : u.v, d = o.edge(c, s), h = d !== void 0 ? d.weight : 0;
        o.setEdge(c, s, { weight: e.edge(u).weight + h });
      }), Object.hasOwn(a, "minRank") && o.setNode(s, { borderLeft: a.borderLeft[t], borderRight: a.borderRight[t] }));
    }), o;
  }
  function Fn(e) {
    for (var t; e.hasNode(t = Sn.uniqueId("_root")); ) ;
    return t;
  }
});
var dt = v((ao, at) => {
  at.exports = Dn;
  function Dn(e, t, r) {
    let n = {}, i;
    r.forEach((o) => {
      let s = e.parent(o), a, l;
      for (; s; ) {
        if (a = e.parent(s), a ? (l = n[a], n[a] = s) : (l = i, i = s), l && l !== s) {
          t.setEdge(l, s);
          return;
        }
        s = a;
      }
    });
  }
});
var ft = v((lo, ct) => {
  "use strict";
  var Gn = Xe(), Vn = Ue(), An = it(), Yn = st(), Bn = dt(), Wn = y().Graph, M = _();
  ct.exports = ht;
  function ht(e, t = {}) {
    if (typeof t.customOrder == "function") {
      t.customOrder(e, ht);
      return;
    }
    let r = M.maxRank(e), n = lt(e, M.range(1, r + 1), "inEdges"), i = lt(e, M.range(r - 1, -1, -1), "outEdges"), o = Gn(e);
    if (ut(e, o), t.disableOptimalOrderHeuristic) return;
    let s = Number.POSITIVE_INFINITY, a, l = t.constraints || [];
    for (let u = 0, c = 0; c < 4; ++u, ++c) {
      zn(u % 2 ? n : i, u % 4 >= 2, l), o = M.buildLayerMatrix(e);
      let d = Vn(e, o);
      d < s ? (c = 0, a = Object.assign({}, o), s = d) : d === s && (a = structuredClone(o));
    }
    ut(e, a);
  }
  function lt(e, t, r) {
    let n = /* @__PURE__ */ new Map(), i = (o, s) => {
      n.has(o) || n.set(o, []), n.get(o).push(s);
    };
    for (let o of e.nodes()) {
      let s = e.node(o);
      if (typeof s.rank == "number" && i(s.rank, o), typeof s.minRank == "number" && typeof s.maxRank == "number") for (let a = s.minRank; a <= s.maxRank; a++) a !== s.rank && i(a, o);
    }
    return t.map(function(o) {
      return Yn(e, o, r, n.get(o) || []);
    });
  }
  function zn(e, t, r) {
    let n = new Wn();
    e.forEach(function(i) {
      r.forEach((a) => n.setEdge(a.left, a.right));
      let o = i.graph().root, s = An(i, o, n, t);
      s.vs.forEach((a, l) => i.node(a).order = l), Bn(i, n, s.vs);
    });
  }
  function ut(e, t) {
    Object.values(t).forEach((r) => r.forEach((n, i) => e.node(n).order = i));
  }
});
var yt = v((uo, kt) => {
  "use strict";
  var Xn = y().Graph, O2 = _();
  kt.exports = { positionX: Kn, findType1Conflicts: pt, findType2Conflicts: mt, addConflict: W, hasConflict: wt, verticalAlignment: bt, horizontalCompaction: vt, alignCoordinates: Et, findSmallestWidthAlignment: gt, balance: _t };
  function pt(e, t) {
    let r = {};
    function n(i, o) {
      let s = 0, a = 0, l = i.length, u = o[o.length - 1];
      return o.forEach((c, d) => {
        let h = Hn(e, c), f = h ? e.node(h).order : l;
        (h || c === u) && (o.slice(a, d + 1).forEach((m) => {
          e.predecessors(m).forEach((p) => {
            let w = e.node(p), b = w.order;
            (b < s || f < b) && !(w.dummy && e.node(m).dummy) && W(r, p, m);
          });
        }), a = d + 1, s = f);
      }), o;
    }
    return t.length && t.reduce(n), r;
  }
  function mt(e, t) {
    let r = {};
    function n(o, s, a, l, u) {
      let c;
      O2.range(s, a).forEach((d) => {
        c = o[d], e.node(c).dummy && e.predecessors(c).forEach((h) => {
          let f = e.node(h);
          f.dummy && (f.order < l || f.order > u) && W(r, h, c);
        });
      });
    }
    function i(o, s) {
      let a = -1, l, u = 0;
      return s.forEach((c, d) => {
        if (e.node(c).dummy === "border") {
          let h = e.predecessors(c);
          h.length && (l = e.node(h[0]).order, n(s, u, d, a, l), u = d, a = l);
        }
        n(s, u, s.length, l, o.length);
      }), s;
    }
    return t.length && t.reduce(i), r;
  }
  function Hn(e, t) {
    if (e.node(t).dummy) return e.predecessors(t).find((r) => e.node(r).dummy);
  }
  function W(e, t, r) {
    if (t > r) {
      let i = t;
      t = r, r = i;
    }
    let n = e[t];
    n || (e[t] = n = {}), n[r] = true;
  }
  function wt(e, t, r) {
    if (t > r) {
      let n = t;
      t = r, r = n;
    }
    return !!e[t] && Object.hasOwn(e[t], r);
  }
  function bt(e, t, r, n) {
    let i = {}, o = {}, s = {};
    return t.forEach((a) => {
      a.forEach((l, u) => {
        i[l] = l, o[l] = l, s[l] = u;
      });
    }), t.forEach((a) => {
      let l = -1;
      a.forEach((u) => {
        let c = n(u);
        if (c.length) {
          c = c.sort((h, f) => s[h] - s[f]);
          let d = (c.length - 1) / 2;
          for (let h = Math.floor(d), f = Math.ceil(d); h <= f; ++h) {
            let m = c[h];
            o[u] === u && l < s[m] && !wt(r, u, m) && (o[m] = u, o[u] = i[u] = i[m], l = s[m]);
          }
        }
      });
    }), { root: i, align: o };
  }
  function vt(e, t, r, n, i) {
    let o = {}, s = Un(e, t, r, i), a = i ? "borderLeft" : "borderRight";
    function l(d, h) {
      let f = s.nodes().slice(), m = {}, p = f.pop();
      for (; p; ) {
        if (m[p]) d(p);
        else {
          m[p] = true, f.push(p);
          for (let w of h(p)) f.push(w);
        }
        p = f.pop();
      }
    }
    function u(d) {
      o[d] = s.inEdges(d).reduce((h, f) => Math.max(h, o[f.v] + s.edge(f)), 0);
    }
    function c(d) {
      let h = s.outEdges(d).reduce((m, p) => Math.min(m, o[p.w] - s.edge(p)), Number.POSITIVE_INFINITY), f = e.node(d);
      h !== Number.POSITIVE_INFINITY && f.borderType !== a && (o[d] = Math.max(o[d], h));
    }
    return l(u, s.predecessors.bind(s)), l(c, s.successors.bind(s)), Object.keys(n).forEach((d) => o[d] = o[r[d]]), o;
  }
  function Un(e, t, r, n) {
    let i = new Xn(), o = e.graph(), s = Qn(o.nodesep, o.edgesep, n);
    return t.forEach((a) => {
      let l;
      a.forEach((u) => {
        let c = r[u];
        if (i.setNode(c), l) {
          var d = r[l], h = i.edge(d, c);
          i.setEdge(d, c, Math.max(s(e, u, l), h || 0));
        }
        l = u;
      });
    }), i;
  }
  function gt(e, t) {
    return Object.values(t).reduce((r, n) => {
      let i = Number.NEGATIVE_INFINITY, o = Number.POSITIVE_INFINITY;
      Object.entries(n).forEach(([a, l]) => {
        let u = Jn(e, a) / 2;
        i = Math.max(l + u, i), o = Math.min(l - u, o);
      });
      let s = i - o;
      return s < r[0] && (r = [s, n]), r;
    }, [Number.POSITIVE_INFINITY, null])[1];
  }
  function Et(e, t) {
    let r = Object.values(t), n = O2.applyWithChunking(Math.min, r), i = O2.applyWithChunking(Math.max, r);
    ["u", "d"].forEach((o) => {
      ["l", "r"].forEach((s) => {
        let a = o + s, l = e[a];
        if (l === t) return;
        let u = Object.values(l), c = n - O2.applyWithChunking(Math.min, u);
        s !== "l" && (c = i - O2.applyWithChunking(Math.max, u)), c && (e[a] = O2.mapValues(l, (d) => d + c));
      });
    });
  }
  function _t(e, t) {
    return O2.mapValues(e.ul, (r, n) => {
      if (t) return e[t.toLowerCase()][n];
      {
        let i = Object.values(e).map((o) => o[n]).sort((o, s) => o - s);
        return (i[1] + i[2]) / 2;
      }
    });
  }
  function Kn(e) {
    let t = O2.buildLayerMatrix(e), r = Object.assign(pt(e, t), mt(e, t)), n = {}, i;
    ["u", "d"].forEach((s) => {
      i = s === "u" ? t : Object.values(t).reverse(), ["l", "r"].forEach((a) => {
        a === "r" && (i = i.map((d) => Object.values(d).reverse()));
        let l = (s === "u" ? e.predecessors : e.successors).bind(e), u = bt(e, i, r, l), c = vt(e, i, u.root, u.align, a === "r");
        a === "r" && (c = O2.mapValues(c, (d) => -d)), n[s + a] = c;
      });
    });
    let o = gt(e, n);
    return Et(n, o), _t(n, e.graph().align);
  }
  function Qn(e, t, r) {
    return (n, i, o) => {
      let s = n.node(i), a = n.node(o), l = 0, u;
      if (l += s.width / 2, Object.hasOwn(s, "labelpos")) switch (s.labelpos.toLowerCase()) {
        case "l":
          u = -s.width / 2;
          break;
        case "r":
          u = s.width / 2;
          break;
      }
      if (u && (l += r ? u : -u), u = 0, l += (s.dummy ? t : e) / 2, l += (a.dummy ? t : e) / 2, l += a.width / 2, Object.hasOwn(a, "labelpos")) switch (a.labelpos.toLowerCase()) {
        case "l":
          u = a.width / 2;
          break;
        case "r":
          u = -a.width / 2;
          break;
      }
      return u && (l += r ? u : -u), u = 0, l;
    };
  }
  function Jn(e, t) {
    return e.node(t).width;
  }
});
var Nt = v((ho, Ot) => {
  "use strict";
  var xt = _(), Zn = yt().positionX;
  Ot.exports = $n;
  function $n(e) {
    e = xt.asNonCompoundGraph(e), ei(e), Object.entries(Zn(e)).forEach(([t, r]) => e.node(t).x = r);
  }
  function ei(e) {
    let t = xt.buildLayerMatrix(e), r = e.graph().ranksep, n = e.graph().rankalign, i = 0;
    t.forEach((o) => {
      let s = o.reduce((a, l) => {
        let u = e.node(l).height;
        return a > u ? a : u;
      }, 0);
      o.forEach((a) => {
        let l = e.node(a);
        n === "top" ? l.y = i + l.height / 2 : n === "bottom" ? l.y = i + s - l.height / 2 : l.y = i + s / 2;
      }), i += s + r;
    });
  }
});
var Rt = v((co, Mt) => {
  "use strict";
  var It = pe(), jt = we(), ti = qe(), ri = _().normalizeRanks, ni = Re(), ii = _().removeEmptyRanks, Ct = Pe(), oi = Ge(), Lt = Be(), si = ft(), ai = Nt(), x = _(), di = y().Graph;
  Mt.exports = li;
  function li(e, t = {}) {
    let r = t.debugTiming ? x.time : x.notime;
    return r("layout", () => {
      let n = r("  buildLayoutGraph", () => gi(e));
      return r("  runLayout", () => ui(n, r, t)), r("  updateInputGraph", () => hi(e, n)), n;
    });
  }
  function ui(e, t, r) {
    t("    makeSpaceForEdgeLabels", () => Ei(e)), t("    removeSelfEdges", () => Ci(e)), t("    acyclic", () => It.run(e)), t("    nestingGraph.run", () => Ct.run(e)), t("    rank", () => ti(x.asNonCompoundGraph(e))), t("    injectEdgeLabelProxies", () => _i(e)), t("    removeEmptyRanks", () => ii(e)), t("    nestingGraph.cleanup", () => Ct.cleanup(e)), t("    normalizeRanks", () => ri(e)), t("    assignRankMinMax", () => ki(e)), t("    removeEdgeLabelProxies", () => yi(e)), t("    normalize.run", () => jt.run(e)), t("    parentDummyChains", () => ni(e)), t("    addBorderSegments", () => oi(e)), t("    order", () => si(e, r)), t("    insertSelfEdges", () => Li(e)), t("    adjustCoordinateSystem", () => Lt.adjust(e)), t("    position", () => ai(e)), t("    positionSelfEdges", () => qi(e)), t("    removeBorderNodes", () => ji(e)), t("    normalize.undo", () => jt.undo(e)), t("    fixupEdgeLabelCoords", () => Ni(e)), t("    undoCoordinateSystem", () => Lt.undo(e)), t("    translateGraph", () => xi(e)), t("    assignNodeIntersects", () => Oi(e)), t("    reversePoints", () => Ii(e)), t("    acyclic.undo", () => It.undo(e));
  }
  function hi(e, t) {
    e.nodes().forEach((r) => {
      let n = e.node(r), i = t.node(r);
      n && (n.x = i.x, n.y = i.y, n.order = i.order, n.rank = i.rank, t.children(r).length && (n.width = i.width, n.height = i.height));
    }), e.edges().forEach((r) => {
      let n = e.edge(r), i = t.edge(r);
      n.points = i.points, Object.hasOwn(i, "x") && (n.x = i.x, n.y = i.y);
    }), e.graph().width = t.graph().width, e.graph().height = t.graph().height;
  }
  var ci = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"], fi = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb", rankalign: "center" }, pi = ["acyclicer", "ranker", "rankdir", "align", "rankalign"], mi = ["width", "height", "rank"], qt = { width: 0, height: 0 }, wi = ["minlen", "weight", "width", "height", "labeloffset"], bi = { minlen: 1, weight: 1, width: 0, height: 0, labeloffset: 10, labelpos: "r" }, vi = ["labelpos"];
  function gi(e) {
    let t = new di({ multigraph: true, compound: true }), r = X(e.graph());
    return t.setGraph(Object.assign({}, fi, z(r, ci), x.pick(r, pi))), e.nodes().forEach((n) => {
      let i = X(e.node(n)), o = z(i, mi);
      Object.keys(qt).forEach((s) => {
        o[s] === void 0 && (o[s] = qt[s]);
      }), t.setNode(n, o), t.setParent(n, e.parent(n));
    }), e.edges().forEach((n) => {
      let i = X(e.edge(n));
      t.setEdge(n, Object.assign({}, bi, z(i, wi), x.pick(i, vi)));
    }), t;
  }
  function Ei(e) {
    let t = e.graph();
    t.ranksep /= 2, e.edges().forEach((r) => {
      let n = e.edge(r);
      n.minlen *= 2, n.labelpos.toLowerCase() !== "c" && (t.rankdir === "TB" || t.rankdir === "BT" ? n.width += n.labeloffset : n.height += n.labeloffset);
    });
  }
  function _i(e) {
    e.edges().forEach((t) => {
      let r = e.edge(t);
      if (r.width && r.height) {
        let n = e.node(t.v), o = { rank: (e.node(t.w).rank - n.rank) / 2 + n.rank, e: t };
        x.addDummyNode(e, "edge-proxy", o, "_ep");
      }
    });
  }
  function ki(e) {
    let t = 0;
    e.nodes().forEach((r) => {
      let n = e.node(r);
      n.borderTop && (n.minRank = e.node(n.borderTop).rank, n.maxRank = e.node(n.borderBottom).rank, t = Math.max(t, n.maxRank));
    }), e.graph().maxRank = t;
  }
  function yi(e) {
    e.nodes().forEach((t) => {
      let r = e.node(t);
      r.dummy === "edge-proxy" && (e.edge(r.e).labelRank = r.rank, e.removeNode(t));
    });
  }
  function xi(e) {
    let t = Number.POSITIVE_INFINITY, r = 0, n = Number.POSITIVE_INFINITY, i = 0, o = e.graph(), s = o.marginx || 0, a = o.marginy || 0;
    function l(u) {
      let c = u.x, d = u.y, h = u.width, f = u.height;
      t = Math.min(t, c - h / 2), r = Math.max(r, c + h / 2), n = Math.min(n, d - f / 2), i = Math.max(i, d + f / 2);
    }
    e.nodes().forEach((u) => l(e.node(u))), e.edges().forEach((u) => {
      let c = e.edge(u);
      Object.hasOwn(c, "x") && l(c);
    }), t -= s, n -= a, e.nodes().forEach((u) => {
      let c = e.node(u);
      c.x -= t, c.y -= n;
    }), e.edges().forEach((u) => {
      let c = e.edge(u);
      c.points.forEach((d) => {
        d.x -= t, d.y -= n;
      }), Object.hasOwn(c, "x") && (c.x -= t), Object.hasOwn(c, "y") && (c.y -= n);
    }), o.width = r - t + s, o.height = i - n + a;
  }
  function Oi(e) {
    e.edges().forEach((t) => {
      let r = e.edge(t), n = e.node(t.v), i = e.node(t.w), o, s;
      r.points ? (o = r.points[0], s = r.points[r.points.length - 1]) : (r.points = [], o = i, s = n), r.points.unshift(x.intersectRect(n, o)), r.points.push(x.intersectRect(i, s));
    });
  }
  function Ni(e) {
    e.edges().forEach((t) => {
      let r = e.edge(t);
      if (Object.hasOwn(r, "x")) switch ((r.labelpos === "l" || r.labelpos === "r") && (r.width -= r.labeloffset), r.labelpos) {
        case "l":
          r.x -= r.width / 2 + r.labeloffset;
          break;
        case "r":
          r.x += r.width / 2 + r.labeloffset;
          break;
      }
    });
  }
  function Ii(e) {
    e.edges().forEach((t) => {
      let r = e.edge(t);
      r.reversed && r.points.reverse();
    });
  }
  function ji(e) {
    e.nodes().forEach((t) => {
      if (e.children(t).length) {
        let r = e.node(t), n = e.node(r.borderTop), i = e.node(r.borderBottom), o = e.node(r.borderLeft[r.borderLeft.length - 1]), s = e.node(r.borderRight[r.borderRight.length - 1]);
        r.width = Math.abs(s.x - o.x), r.height = Math.abs(i.y - n.y), r.x = o.x + r.width / 2, r.y = n.y + r.height / 2;
      }
    }), e.nodes().forEach((t) => {
      e.node(t).dummy === "border" && e.removeNode(t);
    });
  }
  function Ci(e) {
    e.edges().forEach((t) => {
      if (t.v === t.w) {
        var r = e.node(t.v);
        r.selfEdges || (r.selfEdges = []), r.selfEdges.push({ e: t, label: e.edge(t) }), e.removeEdge(t);
      }
    });
  }
  function Li(e) {
    var t = x.buildLayerMatrix(e);
    t.forEach((r) => {
      var n = 0;
      r.forEach((i, o) => {
        var s = e.node(i);
        s.order = o + n, (s.selfEdges || []).forEach((a) => {
          x.addDummyNode(e, "selfedge", { width: a.label.width, height: a.label.height, rank: s.rank, order: o + ++n, e: a.e, label: a.label }, "_se");
        }), delete s.selfEdges;
      });
    });
  }
  function qi(e) {
    e.nodes().forEach((t) => {
      var r = e.node(t);
      if (r.dummy === "selfedge") {
        var n = e.node(r.e.v), i = n.x + n.width / 2, o = n.y, s = r.x - i, a = n.height / 2;
        e.setEdge(r.e, r.label), e.removeNode(t), r.label.points = [{ x: i + 2 * s / 3, y: o - a }, { x: i + 5 * s / 6, y: o - a }, { x: i + s, y: o }, { x: i + 5 * s / 6, y: o + a }, { x: i + 2 * s / 3, y: o + a }], r.label.x = r.x, r.label.y = r.y;
      }
    });
  }
  function z(e, t) {
    return x.mapValues(x.pick(e, t), Number);
  }
  function X(e) {
    var t = {};
    return e && Object.entries(e).forEach(([r, n]) => {
      typeof r == "string" && (r = r.toLowerCase()), t[r] = n;
    }), t;
  }
});
var St = v((fo, Tt) => {
  var Mi = _(), Ri = y().Graph;
  Tt.exports = { debugOrdering: Ti };
  function Ti(e) {
    let t = Mi.buildLayerMatrix(e), r = new Ri({ compound: true, multigraph: true }).setGraph({});
    return e.nodes().forEach((n) => {
      r.setNode(n, { label: n }), r.setParent(n, "layer" + e.node(n).rank);
    }), e.edges().forEach((n) => r.setEdge(n.v, n.w, {}, n.name)), t.forEach((n, i) => {
      let o = "layer" + i;
      r.setNode(o, { rank: "same" }), n.reduce((s, a) => (r.setEdge(s, a, { style: "invis" }), a));
    }), r;
  }
});
var Ft = v((po, Pt) => {
  Pt.exports = "2.0.4";
});
var Si = v((mo, Dt) => {
  Dt.exports = { graphlib: y(), layout: Rt(), debug: St(), util: { time: _().time, notime: _().notime }, version: Ft() };
});
var dagre_esm_default = Si();

// src/features/layout/group-by-prefix.ts
var GROUP_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#e11d48",
  "#0891b2",
  "#a855f7",
  "#d946ef"
];
function groupTablesByPrefix(schema) {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return [];
  const prefixMap = /* @__PURE__ */ new Map();
  for (const table of tables) {
    const parts = table.name.split("_");
    const prefix = parts.length > 1 ? parts[0] : table.name;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix).push(table.id);
  }
  const groups = [];
  const otherTableIds = [];
  let colorIdx = 0;
  for (const [prefix, tableIds] of prefixMap) {
    if (tableIds.length >= 2) {
      groups.push({
        prefix,
        label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        tableIds,
        color: GROUP_COLORS[colorIdx % GROUP_COLORS.length]
      });
      colorIdx++;
    } else {
      otherTableIds.push(...tableIds);
    }
  }
  if (otherTableIds.length > 0) {
    groups.push({
      prefix: "_other",
      label: "Other",
      tableIds: otherTableIds,
      color: "#71717a"
    });
  }
  return groups;
}

// src/features/layout/auto-layout.ts
function computeAutoLayout(schema, _currentPositions, options = { direction: "TB" }) {
  return computeGroupedLayout(schema, options).positions;
}
function computeGroupedLayout(schema, options = { direction: "TB" }) {
  const groups = groupTablesByPrefix(schema);
  const tables = schema.tables;
  const nodeWidth = options.nodeWidth ?? 240;
  if (groups.length <= 1) {
    const positions = flatLayout(schema, options);
    return { positions, layers: {}, tableLayerMap: {} };
  }
  const allPositions = {};
  const layers = {};
  const tableLayerMap = {};
  const groupsPerRow = Math.ceil(Math.sqrt(groups.length));
  let groupX = 0;
  let groupY = 0;
  let maxHeightInRow = 0;
  const GROUP_PADDING = 60;
  const GROUP_GAP = 100;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const g = new dagre_esm_default.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: options.direction,
      nodesep: options.spacing?.x ?? 60,
      ranksep: options.spacing?.y ?? 80,
      marginx: GROUP_PADDING,
      marginy: GROUP_PADDING
    });
    for (const tableId of group.tableIds) {
      const table = tables[tableId];
      if (!table) continue;
      const colCount = table.columns.length;
      const height = 32 + Math.min(colCount, 20) * 26 + 8;
      g.setNode(tableId, { width: nodeWidth, height });
    }
    for (const rel of Object.values(schema.relationships)) {
      if (group.tableIds.includes(rel.sourceTableId) && group.tableIds.includes(rel.targetTableId)) {
        g.setEdge(rel.sourceTableId, rel.targetTableId);
      }
    }
    dagre_esm_default.layout(g);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nodeId of g.nodes()) {
      const node = g.node(nodeId);
      if (!node) continue;
      const x = node.x - (node.width ?? nodeWidth) / 2;
      const y2 = node.y - (node.height ?? 200) / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y2);
      maxX = Math.max(maxX, x + (node.width ?? nodeWidth));
      maxY = Math.max(maxY, y2 + (node.height ?? 200));
    }
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = nodeWidth;
      maxY = 200;
    }
    const groupWidth = maxX - minX + GROUP_PADDING * 2;
    const groupHeight = maxY - minY + GROUP_PADDING * 2 + 30;
    for (const nodeId of g.nodes()) {
      const node = g.node(nodeId);
      if (!node) continue;
      allPositions[nodeId] = {
        x: groupX + (node.x - (node.width ?? nodeWidth) / 2 - minX) + GROUP_PADDING,
        y: groupY + (node.y - (node.height ?? 200) / 2 - minY) + GROUP_PADDING + 30
      };
    }
    const layerId = generateId();
    layers[layerId] = {
      id: layerId,
      name: group.label,
      color: group.color,
      bounds: {
        x: groupX,
        y: groupY,
        w: groupWidth,
        h: groupHeight
      }
    };
    for (const tableId of group.tableIds) {
      tableLayerMap[tableId] = layerId;
    }
    maxHeightInRow = Math.max(maxHeightInRow, groupHeight);
    if ((i + 1) % groupsPerRow === 0) {
      groupX = 0;
      groupY += maxHeightInRow + GROUP_GAP;
      maxHeightInRow = 0;
    } else {
      groupX += groupWidth + GROUP_GAP;
    }
  }
  return { positions: allPositions, layers, tableLayerMap };
}
function flatLayout(schema, options) {
  const g = new dagre_esm_default.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.spacing?.x ?? 80,
    ranksep: options.spacing?.y ?? 120,
    marginx: 50,
    marginy: 50
  });
  for (const table of Object.values(schema.tables)) {
    const colCount = table.columns.length;
    const height = 32 + colCount * 26 + 8;
    g.setNode(table.id, {
      width: options.nodeWidth ?? 240,
      height
    });
  }
  for (const rel of Object.values(schema.relationships)) {
    g.setEdge(rel.sourceTableId, rel.targetTableId);
  }
  dagre_esm_default.layout(g);
  const positions = {};
  for (const nodeId of g.nodes()) {
    const node = g.node(nodeId);
    if (node) {
      positions[nodeId] = {
        x: node.x - (node.width ?? 240) / 2,
        y: node.y - (node.height ?? 200) / 2
      };
    }
  }
  return positions;
}

// src/features/sql/sql-parser.ts
function parseCreateTables(sql) {
  const schema = { tables: {}, relationships: {}, layers: {} };
  const cleaned = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const statements = extractCreateTableStatements(cleaned);
  for (const stmt of statements) {
    const id = generateId();
    const table = {
      id,
      name: stmt.tableName,
      schema: stmt.schema || void 0,
      columns: [],
      indexes: []
    };
    const fks = [];
    const pkColumns = [];
    const parts = splitByComma(stmt.body);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const pkMatch = trimmed.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(",").map((c) => c.trim().replace(/`/g, ""));
        pkColumns.push(...cols);
        continue;
      }
      const uniqueMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+`?\w+`?\s+)?UNIQUE\s+(?:KEY\s+)?(?:`?\w+`?\s+)?\(([^)]+)\)/i);
      if (uniqueMatch) {
        continue;
      }
      if (/^\s*(?:INDEX|KEY)\s/i.test(trimmed)) continue;
      const fkMatch = trimmed.match(
        /^\s*(?:CONSTRAINT\s+`?(\w+)`?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+`?(\w+)`?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/i
      );
      if (fkMatch) {
        fks.push({
          constraintName: fkMatch[1],
          columns: fkMatch[2].split(",").map((c) => c.trim().replace(/`/g, "")),
          refTable: fkMatch[3],
          refColumns: fkMatch[4].split(",").map((c) => c.trim().replace(/`/g, "")),
          onDelete: parseRefAction(fkMatch[5]),
          onUpdate: parseRefAction(fkMatch[6])
        });
        continue;
      }
      const colMatch = trimmed.match(
        /^\s*`?(\w+)`?\s+(\w+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|SIGNED|ZEROFILL))*)/i
      );
      if (colMatch) {
        const colName = colMatch[1];
        const dataType = colMatch[2].toUpperCase();
        const rest = trimmed.slice(colMatch[0].length).toUpperCase();
        const col = {
          id: generateId(),
          name: colName,
          dataType: normalizeDataType(dataType),
          nullable: !rest.includes("NOT NULL"),
          autoIncrement: rest.includes("AUTO_INCREMENT") || rest.includes("SERIAL"),
          isPrimaryKey: rest.includes("PRIMARY KEY"),
          isUnique: rest.includes("UNIQUE")
        };
        const defaultMatch = rest.match(/DEFAULT\s+('(?:[^'\\]|\\.)*'|\S+)/i);
        if (defaultMatch) {
          col.defaultValue = defaultMatch[1].replace(/^'|'$/g, "");
        }
        table.columns.push(col);
      }
    }
    for (const pkCol of pkColumns) {
      const col = table.columns.find((c) => c.name.toLowerCase() === pkCol.toLowerCase());
      if (col) col.isPrimaryKey = true;
    }
    schema.tables[id] = table;
    for (const fk of fks) {
      const relId = generateId();
      schema._pendingFKs ??= [];
      schema._pendingFKs.push({
        ...fk,
        sourceTableId: id,
        relId
      });
    }
  }
  const pending = schema._pendingFKs;
  if (pending) {
    for (const fk of pending) {
      const referencedTable = Object.values(schema.tables).find(
        (t) => t.name.toLowerCase() === fk.refTable.toLowerCase()
      );
      if (!referencedTable) continue;
      const fkTable = schema.tables[fk.sourceTableId];
      if (!fkTable) continue;
      const sourceColumnIds = fk.refColumns.map(
        (colName) => referencedTable.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase())?.id
      ).filter((id) => !!id);
      const targetColumnIds = fk.columns.map(
        (colName) => fkTable.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase())?.id
      ).filter((id) => !!id);
      schema.relationships[fk.relId] = {
        id: fk.relId,
        name: fk.constraintName,
        sourceTableId: referencedTable.id,
        targetTableId: fkTable.id,
        type: "1:N",
        sourceColumnIds,
        targetColumnIds,
        onDelete: fk.onDelete ?? "NO ACTION",
        onUpdate: fk.onUpdate ?? "NO ACTION"
      };
    }
    delete schema._pendingFKs;
  }
  return schema;
}
function extractCreateTableStatements(sql) {
  const results = [];
  const headerRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(\w+)`?\.)?`?(\w+)`?\s*\(/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(sql)) !== null) {
    const schemaName = headerMatch[1] || null;
    const tableName = headerMatch[2];
    const bodyStart = headerMatch.index + headerMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = sql.slice(bodyStart, i - 1);
    results.push({ schema: schemaName, tableName, body });
  }
  return results;
}
function splitByComma(text) {
  const parts = [];
  let depth = 0;
  let current2 = "";
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(current2);
      current2 = "";
      continue;
    }
    current2 += char;
  }
  if (current2.trim()) parts.push(current2);
  return parts;
}
function parseRefAction(action) {
  if (!action) return "NO ACTION";
  const normalized = action.toUpperCase().replace(/\s+/g, " ").trim();
  switch (normalized) {
    case "CASCADE":
      return "CASCADE";
    case "SET NULL":
      return "SET NULL";
    case "SET DEFAULT":
      return "SET DEFAULT";
    case "RESTRICT":
      return "RESTRICT";
    case "NO ACTION":
      return "NO ACTION";
    default:
      return "NO ACTION";
  }
}
function normalizeDataType(dt2) {
  return dt2.replace(/\s+/g, " ").trim();
}

// src/features/db/dialect/alter-fk.ts
var ALTER_FK_RE = new RegExp(
  // ALTER TABLE <t> ADD [CONSTRAINT <name>] FOREIGN KEY (<cols>) REFERENCES <ref> (<refcols>) [ON DELETE ..] [ON UPDATE ..]
  String.raw`ALTER\s+TABLE\s+["` + "`" + String.raw`]?(\w+)["` + "`" + String.raw`]?\s+ADD\s+(?:CONSTRAINT\s+["` + "`" + String.raw`]?(\w+)["` + "`" + String.raw`]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+["` + "`" + String.raw`]?(\w+)["` + "`" + String.raw`]?\s*\(([^)]+)\)` + String.raw`(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?` + String.raw`(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?`,
  "gi"
);
function splitCols(s) {
  return s.split(",").map((c) => c.trim().replace(/["`]/g, "")).filter((c) => c.length > 0);
}
function refAction(a) {
  if (!a) return "NO ACTION";
  const n = a.toUpperCase().replace(/\s+/g, " ").trim();
  switch (n) {
    case "CASCADE":
      return "CASCADE";
    case "SET NULL":
      return "SET NULL";
    case "SET DEFAULT":
      return "SET DEFAULT";
    case "RESTRICT":
      return "RESTRICT";
    default:
      return "NO ACTION";
  }
}
var UNIQUE_RE = new RegExp(
  String.raw`(?:CONSTRAINT\s+["` + "`" + String.raw`]?\w+["` + "`" + String.raw`]?\s+)?UNIQUE\s*(?:KEY\s+)?(?:["` + "`" + String.raw`]?\w+["` + "`" + String.raw`]?\s+)?\(\s*["` + "`" + String.raw`]?(\w+)["` + "`" + String.raw`]?\s*\)`,
  "gi"
);
function attachUniqueConstraints(schema, ddl) {
  const headerRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(/gi;
  let hm;
  while ((hm = headerRe.exec(ddl)) !== null) {
    const tableName = hm[1];
    const start = hm.index + hm[0].length;
    let depth = 1;
    let i = start;
    while (i < ddl.length && depth > 0) {
      const ch = ddl[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = ddl.slice(start, i - 1);
    const table = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === tableName.toLowerCase()
    );
    if (!table) continue;
    UNIQUE_RE.lastIndex = 0;
    let um;
    while ((um = UNIQUE_RE.exec(body)) !== null) {
      const colName = um[1];
      const col = table.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      if (col) col.isUnique = true;
    }
  }
}
function attachAlterForeignKeys(schema, ddl) {
  ALTER_FK_RE.lastIndex = 0;
  let m;
  while ((m = ALTER_FK_RE.exec(ddl)) !== null) {
    const [, fkTableName, constraintName, colStr, refTableName, refColStr, onDel, onUpd] = m;
    const fkTable = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === fkTableName.toLowerCase()
    );
    const refTable = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === refTableName.toLowerCase()
    );
    if (!fkTable || !refTable) continue;
    const cols = splitCols(colStr);
    const refCols = splitCols(refColStr);
    const already = Object.values(schema.relationships).some(
      (r) => r.targetTableId === fkTable.id && r.targetColumnIds.map((id) => fkTable.columns.find((c) => c.id === id)?.name?.toLowerCase()).join() === cols.map((c) => c.toLowerCase()).join()
    );
    if (already) continue;
    const sourceColumnIds = refCols.map((n) => refTable.columns.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id).filter((id) => !!id);
    const targetColumnIds = cols.map((n) => fkTable.columns.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id).filter((id) => !!id);
    const relId = generateId();
    schema.relationships[relId] = {
      id: relId,
      name: constraintName,
      sourceTableId: refTable.id,
      // 참조 PK 측
      targetTableId: fkTable.id,
      // FK 보유 측
      type: "1:N",
      sourceColumnIds,
      targetColumnIds,
      onDelete: refAction(onDel),
      onUpdate: refAction(onUpd)
    };
  }
}

// src/features/db/dialect/canonical.ts
var BASE_ALIAS = {
  INT: "INTEGER",
  INT4: "INTEGER",
  INTEGER: "INTEGER",
  INT2: "SMALLINT",
  SMALLINT: "SMALLINT",
  INT8: "BIGINT",
  BIGINT: "BIGINT",
  BOOL: "BOOLEAN",
  BOOLEAN: "BOOLEAN",
  TINYINT: "BOOLEAN",
  // 관용: TINYINT(1) ↔ BOOLEAN
  NUMERIC: "DECIMAL",
  DECIMAL: "DECIMAL",
  REAL: "FLOAT",
  FLOAT: "FLOAT",
  FLOAT4: "FLOAT",
  DOUBLE: "DOUBLE",
  "DOUBLE PRECISION": "DOUBLE",
  FLOAT8: "DOUBLE",
  CHARACTER: "CHAR",
  CHAR: "CHAR",
  "CHARACTER VARYING": "VARCHAR",
  VARCHAR: "VARCHAR",
  VARCHAR2: "VARCHAR",
  TEXT: "TEXT",
  CLOB: "TEXT",
  DATE: "DATE",
  TIME: "TIME",
  TIMESTAMP: "TIMESTAMP",
  TIMESTAMPTZ: "TIMESTAMP",
  DATETIME: "DATETIME",
  BLOB: "BLOB",
  BYTEA: "BLOB",
  JSON: "JSON",
  JSONB: "JSON",
  UUID: "UUID",
  ENUM: "ENUM",
  SET: "ENUM"
};
function sqliteAffinity(base) {
  const b = base.toUpperCase();
  if (b.includes("INT")) return "INTEGER";
  if (b.includes("CHAR") || b.includes("CLOB") || b.includes("TEXT")) return "TEXT";
  if (b === "BLOB") return "BLOB";
  if (b.includes("REAL") || b.includes("FLOA") || b.includes("DOUB")) return "REAL";
  return "NUMERIC";
}
function parseNativeType(native) {
  const raw = native.trim();
  const upper = raw.toUpperCase();
  const enumMatch = upper.match(/^(ENUM|SET)\s*\(([^)]*)\)/);
  if (enumMatch) {
    const values = enumMatch[2].split(",").map((v2) => v2.trim().replace(/^'|'$/g, "")).filter((v2) => v2.length > 0);
    return { base: "ENUM", enumValues: values, raw };
  }
  const unsigned = /\bUNSIGNED\b/.test(upper);
  const stripped = upper.replace(/\b(UNSIGNED|SIGNED|ZEROFILL)\b/g, "").trim();
  const m = stripped.match(/^([A-Z0-9_ ]+?)\s*(?:\(([^)]*)\))?$/);
  const rawBase = (m?.[1] ?? stripped).trim();
  const argStr = m?.[2];
  const base = BASE_ALIAS[rawBase] ?? rawBase;
  const args = argStr ? argStr.split(",").map((a) => parseInt(a.trim(), 10)).filter((n) => !Number.isNaN(n)) : void 0;
  const canon = { base, raw };
  if (args && args.length > 0) canon.args = args;
  if (unsigned) canon.unsigned = true;
  return canon;
}
function deriveCanonical(col) {
  const canon = parseNativeType(col.dataType);
  if (col.enumValues && col.enumValues.length > 0) {
    canon.base = "ENUM";
    canon.enumValues = col.enumValues;
  }
  return canon;
}
function renderTypeWithArgs(base, args) {
  if (args && args.length > 0) return `${base}(${args.join(", ")})`;
  return base;
}

// src/features/db/dialect/shared.ts
function quote(name, q) {
  return q + name.split(q).join(q + q) + q;
}
function isReservedIn(word, reserved) {
  return reserved.has(word.toUpperCase());
}
function normalizeQuotesForParser(ddl) {
  return ddl.split('"').join("`");
}
function generateAlterFor(diff, caps, q) {
  const out = [];
  for (const t of diff.droppedTables) {
    out.push(`DROP TABLE IF EXISTS ${q(t)};`);
  }
  for (const t of diff.addedTables) {
    out.push(`-- ADD TABLE ${q(t)} (use generate() for full CREATE)`);
  }
  for (const { table, column } of diff.addedColumns) {
    const nn = column.nullable ? "" : " NOT NULL";
    const def = column.defaultValue !== void 0 && column.defaultValue !== "" ? ` DEFAULT ${column.defaultValue}` : "";
    out.push(`ALTER TABLE ${q(table)} ADD COLUMN ${q(column.name)} ${column.dataType}${nn}${def};`);
  }
  for (const { table, column } of diff.droppedColumns) {
    out.push(`ALTER TABLE ${q(table)} DROP COLUMN ${q(column)};`);
  }
  for (const fk of diff.addedRelationships) {
    const name = fk.name ?? `fk_${fk.table}_${fk.columns[0] ?? "x"}`;
    const cols = fk.columns.map(q).join(", ");
    const refCols = fk.refColumns.map(q).join(", ");
    if (caps.alterAddConstraint) {
      out.push(
        `ALTER TABLE ${q(fk.table)} ADD CONSTRAINT ${q(name)} FOREIGN KEY (${cols}) REFERENCES ${q(fk.refTable)} (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`
      );
    } else {
      out.push(
        `-- SQLite: cannot ADD FOREIGN KEY via ALTER (${name}); recreate table ${fk.table} with inline FK to ${fk.refTable}.`
      );
    }
  }
  for (const fk of diff.droppedRelationships) {
    if (caps.alterAddConstraint) {
      out.push(`ALTER TABLE ${q(fk.table)} DROP CONSTRAINT ${q(fk.name)};`);
    } else {
      out.push(
        `-- SQLite: cannot DROP CONSTRAINT ${fk.name} via ALTER; recreate table ${fk.table}.`
      );
    }
  }
  return out.join("\n");
}

// src/features/db/dialect/sqlite.ts
var CAPS = {
  identifierQuote: '"',
  schemas: false,
  autoIncrement: "autoincrement",
  // INTEGER PRIMARY KEY AUTOINCREMENT
  enumStyle: "check",
  // native ENUM 없음 → CHECK(또는 폴백 TEXT)
  inlineForeignKeys: true,
  // ALTER ADD FK 불가 → 본문 인라인만
  alterAddConstraint: false,
  partialIndexes: true,
  expressionIndexes: true,
  checkConstraints: true,
  engineCharset: false,
  sequences: false,
  identifierMaxLen: 0
  // 사실상 제한 없음
};
function mapCanonical(canon, _col) {
  const base = canon.base;
  switch (base) {
    case "BOOLEAN":
      return "INTEGER";
    // SQLite 는 0/1
    case "SMALLINT":
    case "INTEGER":
    case "BIGINT":
      return "INTEGER";
    case "FLOAT":
    case "DOUBLE":
      return "REAL";
    case "DECIMAL":
      return "NUMERIC";
    case "CHAR":
    case "VARCHAR":
    case "TEXT":
    case "UUID":
    case "ENUM":
    // 폴백: TEXT affinity
    case "JSON":
      return "TEXT";
    case "BLOB":
      return "BLOB";
    case "DATE":
    case "TIME":
    case "TIMESTAMP":
    case "DATETIME":
      return "TEXT";
    // SQLite 권장: ISO8601 텍스트
    default:
      return sqliteAffinity(base);
  }
}
var RESERVED = /* @__PURE__ */ new Set([
  "ABORT",
  "ADD",
  "ALTER",
  "AND",
  "AS",
  "AUTOINCREMENT",
  "CONSTRAINT",
  "CREATE",
  "DEFAULT",
  "DELETE",
  "DROP",
  "FOREIGN",
  "FROM",
  "GROUP",
  "INDEX",
  "KEY",
  "ORDER",
  "PRIMARY",
  "REFERENCES",
  "SELECT",
  "TABLE",
  "UNIQUE",
  "UPDATE",
  "WHERE"
]);
function parseSqlite(ddl) {
  const schema = parseCreateTables(normalizeQuotesForParser(ddl));
  attachUniqueConstraints(schema, ddl);
  for (const table of Object.values(schema.tables)) {
    for (const col of table.columns) {
      const re = new RegExp(
        `["\`]?${escapeRe(col.name)}["\`]?[^,(]*?\\bAUTOINCREMENT\\b`,
        "i"
      );
      if (re.test(ddl)) {
        col.autoIncrement = true;
        col.isPrimaryKey = true;
      }
    }
  }
  return { schema, warnings: [] };
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function generateSqlite(schema) {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return "-- No tables defined yet";
  const rels = Object.values(schema.relationships);
  const sorted = topoSort(tables, rels);
  const q = (n) => quote(n, '"');
  const blocks = [];
  for (const table of sorted) {
    blocks.push(generateCreate(table, schema, q));
  }
  return blocks.join("\n\n");
}
function generateCreate(table, schema, q) {
  const lines = [];
  const pkCols = table.columns.filter((c) => c.isPrimaryKey);
  const singleIntPk = pkCols.length === 1 && pkCols[0].autoIncrement;
  for (const col of table.columns) {
    const canon = deriveCanonical(col);
    const type = mapCanonical(canon, col);
    let def = `  ${q(col.name)} ${type}`;
    if (singleIntPk && col.isPrimaryKey && col.autoIncrement) {
      def = `  ${q(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
    } else {
      if (!col.nullable) def += " NOT NULL";
      if (col.isUnique && !col.isPrimaryKey) def += " UNIQUE";
      if (col.defaultValue !== void 0 && col.defaultValue !== "") {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }
    lines.push(def);
  }
  if (!singleIntPk && pkCols.length > 0) {
    lines.push(`  PRIMARY KEY (${pkCols.map((c) => q(c.name)).join(", ")})`);
  }
  for (const rel of Object.values(schema.relationships)) {
    if (rel.targetTableId !== table.id) continue;
    const refTable = schema.tables[rel.sourceTableId];
    if (!refTable) continue;
    const cols = rel.targetColumnIds.map((id) => table.columns.find((c) => c.id === id)?.name).filter((n) => !!n);
    const refCols = rel.sourceColumnIds.map((id) => refTable.columns.find((c) => c.id === id)?.name).filter((n) => !!n);
    if (cols.length === 0 || refCols.length === 0) continue;
    let fk = `  CONSTRAINT ${q(rel.name ?? `fk_${table.name}_${refTable.name}`)} FOREIGN KEY (${cols.map(q).join(", ")}) REFERENCES ${q(refTable.name)} (${refCols.map(q).join(", ")})`;
    if (rel.onDelete && rel.onDelete !== "NO ACTION") fk += ` ON DELETE ${rel.onDelete}`;
    if (rel.onUpdate && rel.onUpdate !== "NO ACTION") fk += ` ON UPDATE ${rel.onUpdate}`;
    lines.push(fk);
  }
  return `CREATE TABLE ${q(table.name)} (
${lines.join(",\n")}
);`;
}
function topoSort(tables, rels) {
  const map = new Map(tables.map((t) => [t.id, t]));
  const indeg = /* @__PURE__ */ new Map();
  const adj = /* @__PURE__ */ new Map();
  for (const t of tables) {
    indeg.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const r of rels) {
    if (map.has(r.sourceTableId) && map.has(r.targetTableId)) {
      adj.get(r.sourceTableId).push(r.targetTableId);
      indeg.set(r.targetTableId, (indeg.get(r.targetTableId) ?? 0) + 1);
    }
  }
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const result = [];
  while (queue.length > 0) {
    const cur = queue.shift();
    const t = map.get(cur);
    if (t) result.push(t);
    for (const nb of adj.get(cur) ?? []) {
      const d = (indeg.get(nb) ?? 1) - 1;
      indeg.set(nb, d);
      if (d === 0) queue.push(nb);
    }
  }
  for (const t of tables) if (!result.find((r) => r.id === t.id)) result.push(t);
  return result;
}
var sqliteDialect = {
  id: "sqlite",
  displayName: "SQLite",
  caps: CAPS,
  parse: parseSqlite,
  generate: generateSqlite,
  generateAlter(diff) {
    return generateAlterFor(diff, CAPS, (n) => quote(n, CAPS.identifierQuote));
  },
  quoteIdent(name) {
    return quote(name, CAPS.identifierQuote);
  },
  isReserved(word) {
    return isReservedIn(word, RESERVED);
  },
  mapType(canonical, col) {
    return mapCanonical(canonical, col);
  },
  parseType(native) {
    return deriveCanonical({ dataType: native });
  }
};

// src/features/sql/ddl-generator.ts
function generateDDL(schema, dialect) {
  const tables = Object.values(schema.tables);
  const relationships = Object.values(schema.relationships);
  if (tables.length === 0) {
    return `-- No tables defined yet`;
  }
  const sorted = topologicalSort(tables, relationships);
  const statements = [];
  for (const table of sorted) {
    statements.push(generateCreateTable(table, dialect));
  }
  for (const rel of relationships) {
    const fk = generateForeignKey(rel, schema.tables, dialect);
    if (fk) statements.push(fk);
  }
  const header = dialect === "mysql" ? `-- Generated by ERD Studio for MySQL
-- Date: ${(/* @__PURE__ */ new Date()).toISOString()}` : `-- Generated by ERD Studio for PostgreSQL
-- Date: ${(/* @__PURE__ */ new Date()).toISOString()}`;
  return header + "\n\n" + statements.join("\n\n");
}
function topologicalSort(tables, relationships) {
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const inDegree = /* @__PURE__ */ new Map();
  const adjacency = /* @__PURE__ */ new Map();
  for (const t of tables) {
    inDegree.set(t.id, 0);
    adjacency.set(t.id, []);
  }
  for (const rel of relationships) {
    if (tableMap.has(rel.sourceTableId) && tableMap.has(rel.targetTableId)) {
      adjacency.get(rel.sourceTableId).push(rel.targetTableId);
      inDegree.set(rel.targetTableId, (inDegree.get(rel.targetTableId) ?? 0) + 1);
    }
  }
  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const result = [];
  while (queue.length > 0) {
    const current2 = queue.shift();
    const table = tableMap.get(current2);
    if (table) result.push(table);
    for (const neighbor of adjacency.get(current2) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  for (const t of tables) {
    if (!result.find((r) => r.id === t.id)) {
      result.push(t);
    }
  }
  return result;
}
function generateCreateTable(table, dialect) {
  const q = dialect === "mysql" ? "`" : '"';
  const lines = [];
  for (const col of table.columns) {
    lines.push("  " + generateColumnDef(col, dialect));
  }
  const pkCols = table.columns.filter((c) => c.isPrimaryKey);
  if (pkCols.length > 0) {
    lines.push(`  PRIMARY KEY (${pkCols.map((c) => `${q}${c.name}${q}`).join(", ")})`);
  }
  for (const col of table.columns) {
    if (col.isUnique && !col.isPrimaryKey) {
      lines.push(`  UNIQUE (${q}${col.name}${q})`);
    }
  }
  for (const idx of table.indexes) {
    const colNames = idx.columnIds.map((cid) => table.columns.find((c) => c.id === cid)?.name).filter(Boolean).map((n) => `${q}${n}${q}`);
    if (colNames.length > 0) {
      const uniqueKw = idx.unique ? "UNIQUE " : "";
      lines.push(`  ${uniqueKw}INDEX ${q}${idx.name}${q} (${colNames.join(", ")})`);
    }
  }
  let ddl = `CREATE TABLE ${q}${table.name}${q} (
${lines.join(",\n")}
)`;
  if (dialect === "mysql") {
    const engine = table.engine ?? "InnoDB";
    const charset = table.charset ?? "utf8mb4";
    ddl += ` ENGINE=${engine} DEFAULT CHARSET=${charset}`;
  }
  ddl += ";";
  if (table.comment) {
    ddl += ` -- ${table.comment}`;
  }
  return ddl;
}
function generateColumnDef(col, dialect) {
  const q = dialect === "mysql" ? "`" : '"';
  const parts = [`${q}${col.name}${q}`];
  parts.push(resolveDataType(col, dialect));
  if (!col.nullable) {
    parts.push("NOT NULL");
  }
  if (col.autoIncrement) {
    if (dialect === "mysql") {
      parts.push("AUTO_INCREMENT");
    }
  }
  if (col.defaultValue !== void 0 && col.defaultValue !== "") {
    parts.push(`DEFAULT ${col.defaultValue}`);
  }
  return parts.join(" ");
}
function resolveDataType(col, dialect) {
  const dt2 = col.dataType.toUpperCase();
  if (dialect === "postgresql" && col.autoIncrement) {
    if (dt2 === "INT" || dt2 === "INTEGER") return "SERIAL";
    if (dt2 === "BIGINT") return "BIGSERIAL";
    if (dt2 === "SMALLINT") return "SMALLSERIAL";
  }
  if (col.length && ["VARCHAR", "CHAR", "VARBINARY", "BINARY"].includes(dt2)) {
    return `${dt2}(${col.length})`;
  }
  if (col.precision !== void 0 && col.scale !== void 0 && ["DECIMAL", "NUMERIC"].includes(dt2)) {
    return `${dt2}(${col.precision}, ${col.scale})`;
  }
  if (col.enumValues && col.enumValues.length > 0 && (dt2 === "ENUM" || dt2 === "SET")) {
    const vals = col.enumValues.map((v2) => `'${v2}'`).join(", ");
    if (dialect === "mysql") {
      return `${dt2}(${vals})`;
    }
    return "VARCHAR(255)";
  }
  return dt2;
}
function generateForeignKey(rel, tables, dialect) {
  const sourceTable = tables[rel.sourceTableId];
  const targetTable = tables[rel.targetTableId];
  if (!sourceTable || !targetTable) return null;
  const q = dialect === "mysql" ? "`" : '"';
  const sourceColNames = rel.sourceColumnIds.map((cid) => sourceTable.columns.find((c) => c.id === cid)?.name).filter(Boolean);
  const targetColNames = rel.targetColumnIds.map((cid) => targetTable.columns.find((c) => c.id === cid)?.name).filter(Boolean);
  if (sourceColNames.length === 0 || targetColNames.length === 0) return null;
  const fkName = rel.name ?? `fk_${targetTable.name}_${sourceTable.name}`;
  return `ALTER TABLE ${q}${targetTable.name}${q}
  ADD CONSTRAINT ${q}${fkName}${q}
  FOREIGN KEY (${targetColNames.map((n) => `${q}${n}${q}`).join(", ")})
  REFERENCES ${q}${sourceTable.name}${q} (${sourceColNames.map((n) => `${q}${n}${q}`).join(", ")})
  ON DELETE ${rel.onDelete}
  ON UPDATE ${rel.onUpdate};`;
}

// src/features/db/dialect/mysql.ts
var CAPS2 = {
  identifierQuote: "`",
  schemas: false,
  // MySQL 의 "schema" 는 database 와 동의어 — ERD 모델에선 비사용 취급
  autoIncrement: "autoincrement",
  // AUTO_INCREMENT 키워드
  enumStyle: "native",
  // ENUM('a','b')
  inlineForeignKeys: false,
  // ddl-generator 는 ALTER 로 분리
  alterAddConstraint: true,
  partialIndexes: false,
  expressionIndexes: true,
  // 8.0.13+
  checkConstraints: true,
  // 8.0.16+
  engineCharset: true,
  sequences: false,
  identifierMaxLen: 64
};
function mapCanonical2(canon, col) {
  const base = canon.base;
  const unsigned = canon.unsigned ? " UNSIGNED" : "";
  switch (base) {
    case "BOOLEAN":
      return "TINYINT(1)";
    case "INTEGER":
      return `INT${unsigned}`;
    case "SMALLINT":
      return `SMALLINT${unsigned}`;
    case "BIGINT":
      return `BIGINT${unsigned}`;
    case "FLOAT":
      return "FLOAT";
    case "DOUBLE":
      return "DOUBLE";
    case "DECIMAL":
      return renderTypeWithArgs("DECIMAL", canon.args);
    case "VARCHAR":
      return renderTypeWithArgs("VARCHAR", canon.args ?? [255]);
    case "CHAR":
      return renderTypeWithArgs("CHAR", canon.args);
    case "TEXT":
      return "TEXT";
    case "BLOB":
      return "BLOB";
    case "JSON":
      return "JSON";
    case "UUID":
      return "CHAR(36)";
    case "DATETIME":
      return "DATETIME";
    case "TIMESTAMP":
      return "TIMESTAMP";
    case "DATE":
      return "DATE";
    case "TIME":
      return "TIME";
    case "ENUM": {
      const vals = canon.enumValues ?? col.enumValues ?? [];
      if (vals.length > 0) return `ENUM(${vals.map((v2) => `'${v2}'`).join(", ")})`;
      return "VARCHAR(255)";
    }
    default:
      return canon.raw ?? renderTypeWithArgs(base, canon.args);
  }
}
var RESERVED2 = /* @__PURE__ */ new Set([
  "ADD",
  "ALTER",
  "AUTO_INCREMENT",
  "BETWEEN",
  "BY",
  "CONSTRAINT",
  "CREATE",
  "DEFAULT",
  "DELETE",
  "DROP",
  "FOREIGN",
  "FROM",
  "GROUP",
  "INDEX",
  "INSERT",
  "KEY",
  "ORDER",
  "PRIMARY",
  "REFERENCES",
  "SELECT",
  "TABLE",
  "UNIQUE",
  "UPDATE",
  "WHERE"
]);
var mysqlDialect = {
  id: "mysql",
  displayName: "MySQL",
  caps: CAPS2,
  parse(ddl) {
    const schema = parseCreateTables(ddl);
    attachUniqueConstraints(schema, ddl);
    attachAlterForeignKeys(schema, ddl);
    return { schema, warnings: [] };
  },
  generate(schema) {
    return generateDDL(schema, "mysql");
  },
  generateAlter(diff) {
    return generateAlterFor(diff, CAPS2, (n) => quote(n, CAPS2.identifierQuote));
  },
  quoteIdent(name) {
    return quote(name, CAPS2.identifierQuote);
  },
  isReserved(word) {
    return isReservedIn(word, RESERVED2);
  },
  mapType(canonical, col) {
    return mapCanonical2(canonical, col);
  },
  parseType(native) {
    return deriveCanonical({ dataType: native });
  }
};

// src/features/db/dialect/postgresql.ts
var CAPS3 = {
  identifierQuote: '"',
  schemas: true,
  autoIncrement: "serial",
  // SERIAL/BIGSERIAL (ddl-generator 가 실현)
  enumStyle: "check",
  // 인라인 native ENUM 미지원 → CHECK/별도 타입; 본 엔진은 VARCHAR 폴백
  inlineForeignKeys: false,
  alterAddConstraint: true,
  partialIndexes: true,
  expressionIndexes: true,
  checkConstraints: true,
  engineCharset: false,
  sequences: true,
  identifierMaxLen: 63
};
function mapCanonical3(canon, _col) {
  const base = canon.base;
  switch (base) {
    case "BOOLEAN":
      return "BOOLEAN";
    case "INTEGER":
      return "INTEGER";
    case "SMALLINT":
      return "SMALLINT";
    case "BIGINT":
      return "BIGINT";
    case "FLOAT":
      return "REAL";
    case "DOUBLE":
      return "DOUBLE PRECISION";
    case "DECIMAL":
      return renderTypeWithArgs("NUMERIC", canon.args);
    case "VARCHAR":
      return renderTypeWithArgs("VARCHAR", canon.args ?? [255]);
    case "CHAR":
      return renderTypeWithArgs("CHAR", canon.args);
    case "TEXT":
      return "TEXT";
    case "BLOB":
      return "BYTEA";
    case "JSON":
      return "JSONB";
    case "UUID":
      return "UUID";
    case "DATETIME":
      return "TIMESTAMP";
    case "TIMESTAMP":
      return "TIMESTAMP";
    case "DATE":
      return "DATE";
    case "TIME":
      return "TIME";
    case "ENUM":
      return "VARCHAR(255)";
    default:
      return canon.raw ?? renderTypeWithArgs(base, canon.args);
  }
}
var RESERVED3 = /* @__PURE__ */ new Set([
  "ALL",
  "ANALYSE",
  "ANALYZE",
  "AND",
  "ANY",
  "AS",
  "ASC",
  "CONSTRAINT",
  "CREATE",
  "DEFAULT",
  "DESC",
  "DISTINCT",
  "DO",
  "FOREIGN",
  "FROM",
  "GROUP",
  "INDEX",
  "KEY",
  "ORDER",
  "PRIMARY",
  "REFERENCES",
  "SELECT",
  "TABLE",
  "UNIQUE",
  "USER",
  "WHERE"
]);
var postgresqlDialect = {
  id: "postgresql",
  displayName: "PostgreSQL",
  caps: CAPS3,
  parse(ddl) {
    const schema = parseCreateTables(normalizeQuotesForParser(ddl));
    attachUniqueConstraints(schema, ddl);
    attachAlterForeignKeys(schema, ddl);
    for (const table of Object.values(schema.tables)) {
      for (const col of table.columns) {
        const dt2 = col.dataType.toUpperCase();
        if (dt2 === "SERIAL") {
          col.dataType = "INTEGER";
          col.autoIncrement = true;
        } else if (dt2 === "BIGSERIAL") {
          col.dataType = "BIGINT";
          col.autoIncrement = true;
        } else if (dt2 === "SMALLSERIAL") {
          col.dataType = "SMALLINT";
          col.autoIncrement = true;
        }
      }
    }
    return { schema, warnings: [] };
  },
  generate(schema) {
    return generateDDL(schema, "postgresql");
  },
  generateAlter(diff) {
    return generateAlterFor(diff, CAPS3, (n) => quote(n, CAPS3.identifierQuote));
  },
  quoteIdent(name) {
    return quote(name, CAPS3.identifierQuote);
  },
  isReserved(word) {
    return isReservedIn(word, RESERVED3);
  },
  mapType(canonical, col) {
    return mapCanonical3(canonical, col);
  },
  parseType(native) {
    return deriveCanonical({ dataType: native });
  }
};

// src/features/db/dialect/registry.ts
var dialectRegistry = {
  sqlite: sqliteDialect,
  mysql: mysqlDialect,
  postgresql: postgresqlDialect
};
function getDialect(id) {
  const d = dialectRegistry[id];
  if (!d) throw new Error(`Unknown dialect: ${id}`);
  return d;
}

// src/features/convert/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerConverter(converter) {
  registry.set(converter.id, converter);
}

// src/features/convert/type-map.ts
var SQL_TO_PRISMA = {
  INT: "Int",
  INTEGER: "Int",
  SMALLINT: "Int",
  TINYINT: "Int",
  BIGINT: "BigInt",
  SERIAL: "Int",
  BIGSERIAL: "BigInt",
  DECIMAL: "Decimal",
  NUMERIC: "Decimal",
  FLOAT: "Float",
  DOUBLE: "Float",
  REAL: "Float",
  VARCHAR: "String",
  CHAR: "String",
  TEXT: "String",
  LONGTEXT: "String",
  UUID: "String",
  BOOL: "Boolean",
  BOOLEAN: "Boolean",
  DATE: "DateTime",
  DATETIME: "DateTime",
  TIMESTAMP: "DateTime",
  TIME: "DateTime",
  JSON: "Json",
  JSONB: "Json",
  BYTEA: "Bytes",
  BLOB: "Bytes"
};
var PRISMA_TO_SQL = {
  Int: "INT",
  BigInt: "BIGINT",
  Decimal: "DECIMAL",
  Float: "FLOAT",
  String: "VARCHAR",
  Boolean: "BOOLEAN",
  DateTime: "TIMESTAMP",
  Json: "JSON",
  Bytes: "BYTEA"
};
var SQL_TO_DBML = {
  INT: "int",
  INTEGER: "integer",
  BIGINT: "bigint",
  SMALLINT: "smallint",
  TINYINT: "tinyint",
  DECIMAL: "decimal",
  NUMERIC: "numeric",
  FLOAT: "float",
  DOUBLE: "double",
  VARCHAR: "varchar",
  CHAR: "char",
  TEXT: "text",
  BOOL: "boolean",
  BOOLEAN: "boolean",
  DATE: "date",
  DATETIME: "datetime",
  TIMESTAMP: "timestamp",
  JSON: "json",
  UUID: "uuid"
};
function baseSqlType(dataType) {
  return dataType.toUpperCase().replace(/\(.*\)/, "").replace(/\b(UNSIGNED|SIGNED|ZEROFILL)\b/g, "").trim();
}
function sqlToPrisma(dataType) {
  const base = baseSqlType(dataType);
  const mapped = SQL_TO_PRISMA[base];
  if (mapped) return { type: mapped };
  return { type: "String", warning: `\uBBF8\uC9C0\uC6D0 SQL \uD0C0\uC785 "${dataType}" \u2192 Prisma String \uC73C\uB85C \uB300\uCCB4` };
}
function prismaToSql(prismaType) {
  const mapped = PRISMA_TO_SQL[prismaType];
  if (mapped) return { type: mapped };
  return { type: prismaType.toUpperCase(), warning: `\uBBF8\uC9C0\uC6D0 Prisma \uD0C0\uC785 "${prismaType}" \u2014 \uC6D0\uD615 \uC720\uC9C0` };
}
function sqlToDbml(dataType) {
  const base = baseSqlType(dataType);
  return SQL_TO_DBML[base] ?? base.toLowerCase();
}
function dbmlToSql(dbmlType) {
  return dbmlType.toUpperCase().replace(/\(.*\)/, "").trim();
}

// src/features/convert/prisma.ts
function generatePrisma(schema) {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return "// \uC815\uC758\uB41C \uD14C\uC774\uBE14\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
  const relsByTarget = /* @__PURE__ */ new Map();
  for (const rel of Object.values(schema.relationships)) {
    const arr = relsByTarget.get(rel.targetTableId) ?? [];
    arr.push(rel);
    relsByTarget.set(rel.targetTableId, arr);
  }
  const relsBySource = /* @__PURE__ */ new Map();
  for (const rel of Object.values(schema.relationships)) {
    const arr = relsBySource.get(rel.sourceTableId) ?? [];
    arr.push(rel);
    relsBySource.set(rel.sourceTableId, arr);
  }
  const blocks = [];
  for (const table of tables) {
    const lines = [`model ${table.name} {`];
    for (const col of table.columns) {
      lines.push("  " + generateFieldLine(col));
    }
    for (const rel of relsByTarget.get(table.id) ?? []) {
      const refTable = schema.tables[rel.sourceTableId];
      if (!refTable) continue;
      const fkCols = rel.targetColumnIds.map((id) => table.columns.find((c) => c.id === id)?.name).filter((n) => !!n);
      const refCols = rel.sourceColumnIds.map((id) => refTable.columns.find((c) => c.id === id)?.name).filter((n) => !!n);
      if (fkCols.length === 0 || refCols.length === 0) continue;
      const fieldName = lowerFirst(refTable.name);
      lines.push(
        `  ${fieldName} ${refTable.name} @relation(fields: [${fkCols.join(", ")}], references: [${refCols.join(", ")}])`
      );
    }
    for (const rel of relsBySource.get(table.id) ?? []) {
      const fkTable = schema.tables[rel.targetTableId];
      if (!fkTable) continue;
      const fieldName = lowerFirst(fkTable.name) + "s";
      lines.push(`  ${fieldName} ${fkTable.name}[]`);
    }
    lines.push("}");
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n") + "\n";
}
function generateFieldLine(col) {
  const { type } = sqlToPrisma(col.dataType);
  let line = `${col.name} ${type}${col.nullable && !col.isPrimaryKey ? "?" : ""}`;
  const attrs = [];
  if (col.isPrimaryKey) attrs.push("@id");
  if (col.isUnique && !col.isPrimaryKey) attrs.push("@unique");
  if (col.autoIncrement) attrs.push("@default(autoincrement())");
  else if (col.defaultValue !== void 0 && col.defaultValue !== "") {
    attrs.push(`@default(${formatDefault(col.defaultValue, type)})`);
  }
  if (attrs.length > 0) line += " " + attrs.join(" ");
  return line;
}
function formatDefault(value, prismaType) {
  if (prismaType === "Int" || prismaType === "BigInt" || prismaType === "Float" || prismaType === "Decimal") {
    return value;
  }
  if (prismaType === "Boolean") return value.toLowerCase();
  if (/^".*"$/.test(value)) return value;
  return `"${value}"`;
}
function lowerFirst(s) {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}
function parsePrisma(input) {
  const schema = { tables: {}, relationships: {}, layers: {} };
  const warnings = [];
  const cleaned = input.replace(/\/\/[^\n]*/g, "");
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m;
  const pendingRels = [];
  const tableIdByName = /* @__PURE__ */ new Map();
  while ((m = modelRegex.exec(cleaned)) !== null) {
    const modelName = m[1];
    const body = m[2];
    const tableId = generateId();
    const table = { id: tableId, name: modelName, columns: [], indexes: [] };
    tableIdByName.set(modelName, tableId);
    const fieldLines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("@@"));
    for (const line of fieldLines) {
      const relMatch = line.match(/@relation\(\s*fields:\s*\[([^\]]+)\],\s*references:\s*\[([^\]]+)\]/);
      if (relMatch) {
        const fieldHead = line.match(/^(\w+)\s+(\w+)/);
        const refTableName = fieldHead ? fieldHead[2] : "";
        pendingRels.push({
          fkTableName: modelName,
          fkCols: splitList(relMatch[1]),
          refTableName,
          refCols: splitList(relMatch[2])
        });
        continue;
      }
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;
      const fieldName = fieldMatch[1];
      const prismaType = fieldMatch[2];
      const isList = !!fieldMatch[3];
      const optional = !!fieldMatch[4];
      const attrs = fieldMatch[5];
      if (isList) continue;
      if (/^[A-Z]/.test(prismaType) && !isKnownPrismaScalar(prismaType)) {
        continue;
      }
      const { type: sqlType, warning } = prismaToSql(prismaType);
      if (warning) warnings.push(warning);
      const col = {
        id: generateId(),
        name: fieldName,
        dataType: sqlType,
        nullable: optional,
        autoIncrement: /@default\(\s*autoincrement\(\)\s*\)/.test(attrs),
        isPrimaryKey: /@id\b/.test(attrs),
        isUnique: /@unique\b/.test(attrs)
      };
      const defMatch = attrs.match(/@default\(\s*([^)]*)\)/);
      if (defMatch && !/autoincrement/.test(defMatch[1])) {
        col.defaultValue = defMatch[1].trim().replace(/^"|"$/g, "");
      }
      table.columns.push(col);
    }
    schema.tables[tableId] = table;
  }
  for (const pr of pendingRels) {
    const fkTableId = tableIdByName.get(pr.fkTableName);
    const refTableId = tableIdByName.get(pr.refTableName);
    if (!fkTableId || !refTableId) {
      warnings.push(`\uAD00\uACC4 \uD574\uC11D \uC2E4\uD328: ${pr.fkTableName} \u2192 ${pr.refTableName}`);
      continue;
    }
    const fkTable = schema.tables[fkTableId];
    const refTable = schema.tables[refTableId];
    const targetColumnIds = pr.fkCols.map((n) => fkTable.columns.find((c) => c.name === n)?.id).filter((id) => !!id);
    const sourceColumnIds = pr.refCols.map((n) => refTable.columns.find((c) => c.name === n)?.id).filter((id) => !!id);
    const relId = generateId();
    const rel = {
      id: relId,
      sourceTableId: refTableId,
      // 참조(PK) 측
      targetTableId: fkTableId,
      // FK 보유 측
      type: "1:N",
      sourceColumnIds,
      targetColumnIds,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION"
    };
    schema.relationships[relId] = rel;
  }
  return { schema, warnings };
}
var PRISMA_SCALARS = /* @__PURE__ */ new Set(["Int", "BigInt", "String", "Boolean", "DateTime", "Json", "Bytes", "Decimal", "Float"]);
function isKnownPrismaScalar(t) {
  return PRISMA_SCALARS.has(t);
}
function splitList(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
var prismaConverter = {
  id: "prisma",
  direction: "both",
  parse: parsePrisma,
  generate: generatePrisma
};
registerConverter(prismaConverter);

// src/features/convert/dbml.ts
function generateDbml(schema) {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return "// \uC815\uC758\uB41C \uD14C\uC774\uBE14\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
  const blocks = [];
  for (const table of tables) {
    const lines = [`Table ${table.name} {`];
    for (const col of table.columns) {
      lines.push("  " + generateColumnLine(col));
    }
    lines.push("}");
    blocks.push(lines.join("\n"));
  }
  const refLines = [];
  for (const rel of Object.values(schema.relationships)) {
    const source = schema.tables[rel.sourceTableId];
    const target = schema.tables[rel.targetTableId];
    if (!source || !target) continue;
    const fkCol = target.columns.find((c) => c.id === rel.targetColumnIds[0])?.name;
    const refCol = source.columns.find((c) => c.id === rel.sourceColumnIds[0])?.name;
    if (!fkCol || !refCol) continue;
    const op = relationOperator(rel.type);
    refLines.push(`Ref: ${target.name}.${fkCol} ${op} ${source.name}.${refCol}`);
  }
  return blocks.join("\n\n") + (refLines.length > 0 ? "\n\n" + refLines.join("\n") : "") + "\n";
}
function generateColumnLine(col) {
  const type = sqlToDbml(col.dataType);
  const typeWithLen = col.length && ["varchar", "char"].includes(type) ? `${type}(${col.length})` : type;
  const settings = [];
  if (col.isPrimaryKey) settings.push("pk");
  if (col.autoIncrement) settings.push("increment");
  if (col.isUnique && !col.isPrimaryKey) settings.push("unique");
  if (!col.nullable && !col.isPrimaryKey) settings.push("not null");
  if (col.defaultValue !== void 0 && col.defaultValue !== "") {
    settings.push(`default: ${formatDbmlDefault(col.defaultValue)}`);
  }
  const settingStr = settings.length > 0 ? ` [${settings.join(", ")}]` : "";
  return `${col.name} ${typeWithLen}${settingStr}`;
}
function formatDbmlDefault(value) {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase();
  if (/^`.*`$/.test(value)) return value;
  return `'${value}'`;
}
function relationOperator(type) {
  switch (type) {
    case "1:1":
      return "-";
    case "N:M":
      return "<>";
    case "1:N":
    default:
      return ">";
  }
}
function parseDbml(input) {
  const schema = { tables: {}, relationships: {}, layers: {} };
  const warnings = [];
  const cleaned = input.replace(/\/\/[^\n]*/g, "").replace(/--[^\n]*/g, "");
  const tableIdByName = /* @__PURE__ */ new Map();
  const tableRegex = /Table\s+("?[\w.]+"?)\s*(?:as\s+\w+\s*)?\{([\s\S]*?)\}/g;
  let m;
  while ((m = tableRegex.exec(cleaned)) !== null) {
    const rawName = m[1].replace(/"/g, "");
    const tableName = rawName.includes(".") ? rawName.split(".").pop() : rawName;
    const body = m[2];
    const tableId = generateId();
    const table = { id: tableId, name: tableName, columns: [], indexes: [] };
    tableIdByName.set(tableName, tableId);
    const colLines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !/^(indexes|Note)\b/i.test(l) && l !== "{" && l !== "}");
    for (const line of colLines) {
      const colMatch = line.match(/^("?[\w]+"?)\s+([\w]+(?:\([^)]*\))?)\s*(\[[^\]]*\])?/);
      if (!colMatch) continue;
      const colName = colMatch[1].replace(/"/g, "");
      const rawType = colMatch[2];
      const settings = (colMatch[3] ?? "").toLowerCase();
      const lenMatch = rawType.match(/\((\d+)\)/);
      const col = {
        id: generateId(),
        name: colName,
        dataType: dbmlToSql(rawType),
        nullable: !settings.includes("not null") && !settings.includes("pk"),
        autoIncrement: settings.includes("increment"),
        isPrimaryKey: settings.includes("pk") || settings.includes("primary key"),
        isUnique: settings.includes("unique")
      };
      if (lenMatch) col.length = Number(lenMatch[1]);
      const defMatch = (colMatch[3] ?? "").match(/default:\s*('([^']*)'|`([^`]*)`|[^,\]]+)/i);
      if (defMatch) {
        col.defaultValue = (defMatch[2] ?? defMatch[3] ?? defMatch[1]).trim();
      }
      table.columns.push(col);
    }
    schema.tables[tableId] = table;
  }
  const refRegex = /Ref\s*(?:\w+\s*)?:\s*("?[\w]+"?)\.("?[\w]+"?)\s*(<>|<|>|-)\s*("?[\w]+"?)\.("?[\w]+"?)/g;
  let r;
  while ((r = refRegex.exec(cleaned)) !== null) {
    const leftTable = r[1].replace(/"/g, "");
    const leftCol = r[2].replace(/"/g, "");
    const op = r[3];
    const rightTable = r[4].replace(/"/g, "");
    const rightCol = r[5].replace(/"/g, "");
    let fkTableName, fkColName, refTableName, refColName;
    let type = "1:N";
    if (op === "<") {
      fkTableName = rightTable;
      fkColName = rightCol;
      refTableName = leftTable;
      refColName = leftCol;
    } else if (op === "<>") {
      type = "N:M";
      fkTableName = leftTable;
      fkColName = leftCol;
      refTableName = rightTable;
      refColName = rightCol;
    } else if (op === "-") {
      type = "1:1";
      fkTableName = leftTable;
      fkColName = leftCol;
      refTableName = rightTable;
      refColName = rightCol;
    } else {
      fkTableName = leftTable;
      fkColName = leftCol;
      refTableName = rightTable;
      refColName = rightCol;
    }
    const fkTableId = tableIdByName.get(fkTableName);
    const refTableId = tableIdByName.get(refTableName);
    if (!fkTableId || !refTableId) {
      warnings.push(`Ref \uD574\uC11D \uC2E4\uD328: ${leftTable}.${leftCol} ${op} ${rightTable}.${rightCol}`);
      continue;
    }
    const fkTable = schema.tables[fkTableId];
    const refTable = schema.tables[refTableId];
    const targetColId = fkTable.columns.find((c) => c.name === fkColName)?.id;
    const sourceColId = refTable.columns.find((c) => c.name === refColName)?.id;
    const relId = generateId();
    const rel = {
      id: relId,
      sourceTableId: refTableId,
      // 참조(PK) 측
      targetTableId: fkTableId,
      // FK 보유 측
      type,
      sourceColumnIds: sourceColId ? [sourceColId] : [],
      targetColumnIds: targetColId ? [targetColId] : [],
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION"
    };
    schema.relationships[relId] = rel;
  }
  return { schema, warnings };
}
var dbmlConverter = {
  id: "dbml",
  direction: "both",
  parse: parseDbml,
  generate: generateDbml
};
registerConverter(dbmlConverter);

// src/features/mermaid/mermaid-generator.ts
function generateMermaid(schema) {
  const lines = ["erDiagram"];
  const fkColumnIds = /* @__PURE__ */ new Set();
  for (const rel of Object.values(schema.relationships)) {
    for (const id of rel.sourceColumnIds) fkColumnIds.add(id);
    for (const id of rel.targetColumnIds) fkColumnIds.add(id);
  }
  for (const table of Object.values(schema.tables)) {
    lines.push(`    ${table.name} {`);
    for (const col of table.columns) {
      const typeName = col.dataType.replace(/\(.*\)/, "");
      let line = `        ${typeName} ${col.name}`;
      const flags = [];
      if (col.isPrimaryKey) flags.push("PK");
      if (fkColumnIds.has(col.id) && !col.isPrimaryKey) flags.push("FK");
      if (col.isUnique && !col.isPrimaryKey) flags.push("UK");
      if (!col.nullable && !col.isPrimaryKey) flags.push('"NOT NULL"');
      if (flags.length > 0) line += " " + flags.join(" ");
      lines.push(line);
    }
    lines.push("    }");
  }
  for (const rel of Object.values(schema.relationships)) {
    const source = schema.tables[rel.sourceTableId];
    const target = schema.tables[rel.targetTableId];
    if (!source || !target) continue;
    let arrow = "";
    switch (rel.type) {
      case "1:1":
        arrow = "||--||";
        break;
      case "1:N":
        arrow = "||--o{";
        break;
      case "N:M":
        arrow = "}o--o{";
        break;
    }
    lines.push(`    ${source.name} ${arrow} ${target.name} : "${rel.name ?? ""}"`);
  }
  return lines.join("\n");
}

// src/features/mermaid/mermaid-parser.ts
function parseMermaid(text) {
  const schema = { tables: {}, relationships: {}, layers: {} };
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("erDiagram") && !l.startsWith("%%"));
  let currentTable = null;
  for (const line of lines) {
    const entityMatch = line.match(/^(\w+)\s*\{$/);
    if (entityMatch) {
      const id = generateId();
      currentTable = { id, name: entityMatch[1], columns: [], indexes: [] };
      schema.tables[id] = currentTable;
      continue;
    }
    if (line === "}") {
      currentTable = null;
      continue;
    }
    if (currentTable) {
      const colMatch = line.match(/^(\w+)\s+(\w+)(.*)$/);
      if (colMatch) {
        const dataType = colMatch[1].toUpperCase();
        const name = colMatch[2];
        const flags = colMatch[3].toUpperCase();
        currentTable.columns.push({
          id: generateId(),
          name,
          dataType,
          nullable: !flags.includes("NOT NULL") && !flags.includes("PK"),
          autoIncrement: false,
          isPrimaryKey: flags.includes("PK"),
          isUnique: flags.includes("UK")
        });
      }
      continue;
    }
    const relMatch = line.match(/^(\w+)\s+(\|{1,2}|[{}]o?)(--)(\|{1,2}|o?[{}])\s+(\w+)\s*:\s*"?([^"]*)"?$/);
    if (relMatch) {
      const sourceName = relMatch[1];
      const leftMarker = relMatch[2];
      const rightMarker = relMatch[4];
      const targetName = relMatch[5];
      let type = "1:N";
      if (rightMarker.includes("{") || leftMarker.includes("{")) {
        if (rightMarker.includes("{") && leftMarker.includes("}")) {
          type = "N:M";
        } else {
          type = "1:N";
        }
      } else {
        type = "1:1";
      }
      const sourceTable = Object.values(schema.tables).find((t) => t.name === sourceName);
      const targetTable = Object.values(schema.tables).find((t) => t.name === targetName);
      if (sourceTable && targetTable) {
        const relId = generateId();
        schema.relationships[relId] = {
          id: relId,
          name: relMatch[6]?.trim() || void 0,
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id,
          type,
          sourceColumnIds: [],
          targetColumnIds: [],
          onDelete: "NO ACTION",
          onUpdate: "NO ACTION"
        };
      }
    }
  }
  return schema;
}

// src/features/migration/mig-dsl/tokenizer.ts
var TokenType = {
  Keyword: "Keyword",
  Ident: "Ident",
  Number: "Number",
  String: "String",
  Comment: "Comment",
  LBrace: "LBrace",
  // {
  RBrace: "RBrace",
  // }
  LParen: "LParen",
  // (
  RParen: "RParen",
  // )
  Semicolon: "Semicolon",
  // ;
  Dot: "Dot",
  // .
  Comma: "Comma",
  // ,
  Arrow: "Arrow",
  // ->
  NL: "NL",
  // 줄바꿈(파서는 무시하지만 위치 보존용으로 노출)
  EOF: "EOF"
};
var KEYWORDS = /* @__PURE__ */ new Set([
  "create",
  "table",
  "alter",
  "add",
  "drop",
  "rename",
  "column",
  "fk",
  "index",
  "unique",
  "on",
  "delete",
  "update",
  "up",
  "down",
  "raw",
  "to",
  "primary",
  "key",
  "not",
  "null",
  "auto_increment",
  "default",
  "check"
]);
function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}
function tokenize(input) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = input.length;
  function advance() {
    const ch = input[i++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }
  while (i < n) {
    const ch = input[i];
    const startLine = line;
    const startCol = col;
    if (ch === "\n") {
      advance();
      tokens.push({ type: TokenType.NL, value: "\n", line: startLine, col: startCol });
      continue;
    }
    if (ch === " " || ch === "	" || ch === "\r") {
      advance();
      continue;
    }
    if (ch === "-" && input[i + 1] === "-") {
      advance();
      advance();
      let value = "";
      while (i < n && input[i] !== "\n") value += advance();
      tokens.push({ type: TokenType.Comment, value: value.trim(), line: startLine, col: startCol });
      continue;
    }
    if (ch === "-" && input[i + 1] === ">") {
      advance();
      advance();
      tokens.push({ type: TokenType.Arrow, value: "->", line: startLine, col: startCol });
      continue;
    }
    if (ch === "'") {
      advance();
      let value = "";
      let closed = false;
      while (i < n) {
        const c = input[i];
        if (c === "'") {
          if (input[i + 1] === "'") {
            advance();
            advance();
            value += "'";
            continue;
          }
          advance();
          closed = true;
          break;
        }
        value += advance();
      }
      if (!closed) {
        throw makeLexError("Unterminated string literal", startLine, startCol);
      }
      tokens.push({ type: TokenType.String, value, line: startLine, col: startCol });
      continue;
    }
    if (isDigit(ch)) {
      let value = "";
      while (i < n && isDigit(input[i])) value += advance();
      tokens.push({ type: TokenType.Number, value, line: startLine, col: startCol });
      continue;
    }
    if (isIdentStart(ch)) {
      let value = "";
      while (i < n && isIdentPart(input[i])) value += advance();
      const lower = value.toLowerCase();
      tokens.push({
        type: KEYWORDS.has(lower) ? TokenType.Keyword : TokenType.Ident,
        value: KEYWORDS.has(lower) ? lower : value,
        line: startLine,
        col: startCol
      });
      continue;
    }
    const punct = {
      "{": TokenType.LBrace,
      "}": TokenType.RBrace,
      "(": TokenType.LParen,
      ")": TokenType.RParen,
      ";": TokenType.Semicolon,
      ".": TokenType.Dot,
      ",": TokenType.Comma
    };
    if (punct[ch] !== void 0) {
      advance();
      tokens.push({ type: punct[ch], value: ch, line: startLine, col: startCol });
      continue;
    }
    throw makeLexError(`Unexpected character '${ch}'`, startLine, startCol);
  }
  tokens.push({ type: TokenType.EOF, value: "", line, col });
  return tokens;
}
function makeLexError(message, line, col) {
  const err = new Error(`${message} (line ${line}, col ${col})`);
  err.line = line;
  err.col = col;
  return err;
}

// src/features/migration/mig-dsl/parser.ts
function makeError(message, tok) {
  const err = new Error(`${message} (line ${tok.line}, col ${tok.col})`);
  err.line = tok.line;
  err.col = tok.col;
  return err;
}
var REF_ACTIONS = {
  cascade: "CASCADE",
  restrict: "RESTRICT",
  set_null: "SET NULL",
  no_action: "NO ACTION",
  set_default: "SET DEFAULT"
};
var Parser = class {
  toks;
  pos = 0;
  warnings = [];
  constructor(input) {
    this.toks = tokenize(input).filter((t) => t.type !== TokenType.NL);
  }
  // ── 토큰 커서 헬퍼 ──────────────────────────────────────────────
  peek() {
    return this.toks[this.pos];
  }
  next() {
    return this.toks[this.pos++];
  }
  atEof() {
    return this.peek().type === TokenType.EOF;
  }
  // 다음 토큰이 특정 키워드인지(소비하지 않음)
  isKeyword(kw) {
    const t = this.peek();
    return t.type === TokenType.Keyword && t.value === kw;
  }
  // 특정 키워드를 기대하고 소비. 아니면 에러.
  expectKeyword(kw) {
    const t = this.peek();
    if (t.type !== TokenType.Keyword || t.value !== kw) {
      throw makeError(`Expected keyword '${kw}'`, t);
    }
    return this.next();
  }
  // 특정 토큰 타입을 기대하고 소비. 아니면 에러.
  expect(type, label) {
    const t = this.peek();
    if (t.type !== type) {
      throw makeError(`Expected ${label}`, t);
    }
    return this.next();
  }
  // 식별자(또는 키워드도 식별자로 허용하지 않음 — 식별자만)
  expectIdent(label = "identifier") {
    const t = this.peek();
    if (t.type !== TokenType.Ident) {
      throw makeError(`Expected ${label}`, t);
    }
    return this.next();
  }
  // qname := (ident '.')? ident → { schema?, name }
  parseQName() {
    const first = this.expectIdent("table name");
    if (this.peek().type === TokenType.Dot) {
      this.next();
      const second = this.expectIdent("table name");
      return { schema: first.value, name: second.value };
    }
    return { name: first.value };
  }
  // ── 진입점 ─────────────────────────────────────────────────────
  parse() {
    while (this.peek().type === TokenType.Comment) this.next();
    let ops = [];
    let downOps = [];
    if (this.isKeyword("up")) {
      ops = this.parseBlock("up");
    } else {
      ops = this.parseStatementsUntilEof();
      return { ops, downOps, warnings: this.warnings };
    }
    while (this.peek().type === TokenType.Comment) this.next();
    if (this.isKeyword("down")) {
      downOps = this.parseBlock("down");
    }
    while (this.peek().type === TokenType.Comment) this.next();
    if (!this.atEof()) {
      throw makeError("Unexpected trailing tokens", this.peek());
    }
    return { ops, downOps, warnings: this.warnings };
  }
  // 'up'|'down' '{' stmt* '}'
  parseBlock(kw) {
    this.expectKeyword(kw);
    this.expect(TokenType.LBrace, "'{'");
    const ops = [];
    while (!this.atEof() && this.peek().type !== TokenType.RBrace) {
      if (this.peek().type === TokenType.Comment) {
        this.next();
        continue;
      }
      ops.push(this.parseStatement());
    }
    this.expect(TokenType.RBrace, "'}'");
    return ops;
  }
  // 블록 없이 톱레벨 문장(EOF 까지)
  parseStatementsUntilEof() {
    const ops = [];
    while (!this.atEof()) {
      if (this.peek().type === TokenType.Comment) {
        this.next();
        continue;
      }
      ops.push(this.parseStatement());
    }
    return ops;
  }
  // 단일 문장 → Operation. 끝에 ';' 강제.
  parseStatement() {
    const head = this.peek();
    if (head.type !== TokenType.Keyword) {
      throw makeError(`Expected statement keyword, got '${head.value}'`, head);
    }
    let op;
    switch (head.value) {
      case "create":
        op = this.parseCreate();
        break;
      case "alter":
        op = this.parseAlter();
        break;
      case "drop":
        op = this.parseDrop();
        break;
      case "rename":
        op = this.parseRenameTable();
        break;
      case "add":
        op = this.parseAdd();
        break;
      case "raw":
        op = this.parseRaw();
        break;
      default:
        throw makeError(`Unknown statement keyword '${head.value}'`, head);
    }
    this.expect(TokenType.Semicolon, "';'");
    return op;
  }
  // create table | create [unique] index
  parseCreate() {
    this.expectKeyword("create");
    if (this.isKeyword("table")) {
      return this.parseCreateTable();
    }
    if (this.isKeyword("unique") || this.isKeyword("index")) {
      return this.parseCreateIndex();
    }
    throw makeError("Expected 'table' or 'index' after 'create'", this.peek());
  }
  // create table qname '(' column_def (';' column_def)* ')'
  parseCreateTable() {
    this.expectKeyword("table");
    const { schema, name } = this.parseQName();
    this.expect(TokenType.LParen, "'('");
    const columns = [];
    while (this.peek().type !== TokenType.RParen && !this.atEof()) {
      columns.push(this.parseColumnDef());
      if (this.peek().type === TokenType.Semicolon) {
        this.next();
      } else if (this.peek().type !== TokenType.RParen) {
        throw makeError("Expected ';' or ')' in column list", this.peek());
      }
    }
    this.expect(TokenType.RParen, "')'");
    const params = { name, columns };
    if (schema) params.schema = schema;
    return this.mkOp("createTable", params);
  }
  // column_def := ident type flag*
  //   flag := 'primary' 'key' | 'auto_increment' | 'not' 'null' | 'null'
  //         | 'unique' | 'default' (string|number|ident)
  parseColumnDef() {
    const nameTok = this.expectIdent("column name");
    const typeTok = this.parseTypeName();
    const col = { name: nameTok.value, dataType: typeTok };
    let sawNotNull = false;
    let sawNull = false;
    while (this.peek().type === TokenType.Keyword) {
      const kw = this.peek().value;
      if (kw === "primary") {
        this.next();
        this.expectKeyword("key");
        col.isPrimaryKey = true;
      } else if (kw === "auto_increment") {
        this.next();
        col.autoIncrement = true;
      } else if (kw === "not") {
        this.next();
        this.expectKeyword("null");
        sawNotNull = true;
      } else if (kw === "null") {
        this.next();
        sawNull = true;
      } else if (kw === "unique") {
        this.next();
        col.isUnique = true;
      } else if (kw === "default") {
        this.next();
        col.defaultValue = this.parseDefaultValue();
      } else {
        break;
      }
    }
    if (sawNotNull) col.nullable = false;
    else if (sawNull) col.nullable = true;
    return col;
  }
  // 타입 이름: 식별자(+선택적 '(' 정수 [',' 정수] ')'). 타입에 붙은 길이/정밀도는 이름에 합친다.
  parseTypeName() {
    const base = this.expectIdent("type name");
    let type = base.value;
    if (this.peek().type === TokenType.LParen) {
      this.next();
      const parts = [];
      while (this.peek().type !== TokenType.RParen && !this.atEof()) {
        const t = this.peek();
        if (t.type === TokenType.Number || t.type === TokenType.Ident) {
          parts.push(this.next().value);
        } else if (t.type === TokenType.Comma) {
          this.next();
        } else {
          throw makeError("Invalid type parameter", t);
        }
      }
      this.expect(TokenType.RParen, "')'");
      type += `(${parts.join(",")})`;
    }
    return type;
  }
  // default 값: 문자열은 따옴표 포함 정규형('...'), 정수/식별자(NULL·CURRENT_TIMESTAMP 등)는 원문
  parseDefaultValue() {
    const t = this.peek();
    if (t.type === TokenType.String) {
      this.next();
      return `'${t.value}'`;
    }
    if (t.type === TokenType.Number) {
      this.next();
      return t.value;
    }
    if (t.type === TokenType.Ident || t.type === TokenType.Keyword) {
      this.next();
      return t.value.toUpperCase() === "NULL" ? "NULL" : t.value;
    }
    throw makeError("Expected default value", t);
  }
  // alter table qname (add|drop|rename|alter) column ...
  parseAlter() {
    this.expectKeyword("alter");
    this.expectKeyword("table");
    const { name: table } = this.parseQName();
    const sub = this.peek();
    if (sub.type !== TokenType.Keyword) {
      throw makeError("Expected add/drop/rename/alter in alter table", sub);
    }
    switch (sub.value) {
      case "add": {
        this.next();
        this.expectKeyword("column");
        const colNameTok = this.expectIdent("column name");
        const typeTok = this.parseTypeName();
        const params = { table, name: colNameTok.value, dataType: typeTok };
        let sawNotNull = false;
        let sawNull = false;
        while (this.peek().type === TokenType.Keyword) {
          const kw = this.peek().value;
          if (kw === "not") {
            this.next();
            this.expectKeyword("null");
            sawNotNull = true;
          } else if (kw === "null") {
            this.next();
            sawNull = true;
          } else if (kw === "unique") {
            this.next();
            params.isUnique = true;
          } else if (kw === "auto_increment") {
            this.next();
            params.autoIncrement = true;
          } else if (kw === "default") {
            this.next();
            params.defaultValue = this.parseDefaultValue();
          } else break;
        }
        if (sawNotNull) params.nullable = false;
        else if (sawNull) params.nullable = true;
        return this.mkOp("addColumn", params);
      }
      case "drop": {
        this.next();
        this.expectKeyword("column");
        const colNameTok = this.expectIdent("column name");
        return this.mkOp("dropColumn", { table, name: colNameTok.value });
      }
      case "rename": {
        this.next();
        this.expectKeyword("column");
        const oldTok = this.expectIdent("column name");
        this.expectKeyword("to");
        const newTok = this.expectIdent("column name");
        return this.mkOp("renameColumn", { table, oldName: oldTok.value, newName: newTok.value });
      }
      case "alter": {
        this.next();
        this.expectKeyword("column");
        const colTok = this.expectIdent("column name");
        const newType = this.parseTypeName();
        return this.mkOp("modifyColumnType", { table, column: colTok.value, newType });
      }
      default:
        throw makeError(`Unknown alter action '${sub.value}'`, sub);
    }
  }
  // drop table qname | drop fk name on qname | drop index name on qname
  parseDrop() {
    this.expectKeyword("drop");
    if (this.isKeyword("table")) {
      this.next();
      const { name } = this.parseQName();
      return this.mkOp("dropTable", { name });
    }
    if (this.isKeyword("fk")) {
      this.next();
      const fkName = this.expectIdent("fk name").value;
      this.expectKeyword("on");
      const { name: table } = this.parseQName();
      return this.mkOp("dropForeignKey", { table, name: fkName });
    }
    if (this.isKeyword("index")) {
      this.next();
      const idxName = this.expectIdent("index name").value;
      this.expectKeyword("on");
      const { name: table } = this.parseQName();
      return this.mkOp("dropIndex", { table, name: idxName });
    }
    throw makeError("Expected 'table', 'fk', or 'index' after 'drop'", this.peek());
  }
  // rename table qname to ident
  parseRenameTable() {
    this.expectKeyword("rename");
    this.expectKeyword("table");
    const { name: oldName } = this.parseQName();
    this.expectKeyword("to");
    const newName = this.expectIdent("new table name").value;
    return this.mkOp("renameTable", { oldName, newName });
  }
  // add fk name on qname '(' cols ')' -> qname '(' cols ')' [on delete X] [on update Y]
  parseAdd() {
    this.expectKeyword("add");
    this.expectKeyword("fk");
    const fkName = this.expectIdent("fk name").value;
    this.expectKeyword("on");
    const { name: table } = this.parseQName();
    const columns = this.parseColumnList();
    this.expect(TokenType.Arrow, "'->'");
    const { name: refTable } = this.parseQName();
    const refColumns = this.parseColumnList();
    let onDelete = "NO ACTION";
    let onUpdate = "NO ACTION";
    while (this.isKeyword("on")) {
      this.next();
      if (this.isKeyword("delete")) {
        this.next();
        onDelete = this.parseRefAction();
      } else if (this.isKeyword("update")) {
        this.next();
        onUpdate = this.parseRefAction();
      } else {
        throw makeError("Expected 'delete' or 'update' after 'on'", this.peek());
      }
    }
    return this.mkOp("addForeignKey", {
      name: fkName,
      table,
      columns,
      refTable,
      refColumns,
      onDelete,
      onUpdate
    });
  }
  // 참조 동작: cascade/restrict/set null/no action/set default
  parseRefAction() {
    const t = this.peek();
    const first = this.consumeWord();
    let key = first.toLowerCase();
    if (key === "set" || key === "no") {
      const second = this.consumeWord();
      key = `${key}_${second.toLowerCase()}`;
    }
    const action = REF_ACTIONS[key];
    if (!action) {
      throw makeError(`Unknown referential action '${key.replace("_", " ")}'`, t);
    }
    return action;
  }
  // 키워드/식별자 어느 쪽이든 단어 하나를 소비해 값 반환
  consumeWord() {
    const t = this.peek();
    if (t.type === TokenType.Keyword || t.type === TokenType.Ident) {
      return this.next().value;
    }
    throw makeError("Expected word", t);
  }
  // create [unique] index name on qname '(' cols ')'
  parseCreateIndex() {
    let unique = false;
    if (this.isKeyword("unique")) {
      this.next();
      unique = true;
    }
    this.expectKeyword("index");
    const idxName = this.expectIdent("index name").value;
    this.expectKeyword("on");
    const { name: table } = this.parseQName();
    const columns = this.parseColumnList();
    return this.mkOp("createIndex", { table, name: idxName, columns, unique });
  }
  // raw '<sql string>'
  parseRaw() {
    this.expectKeyword("raw");
    const sqlTok = this.expect(TokenType.String, "raw SQL string");
    return this.mkOp("raw", { sql: sqlTok.value });
  }
  // '(' ident (',' ident)* ')'
  parseColumnList() {
    this.expect(TokenType.LParen, "'('");
    const cols = [];
    cols.push(this.expectIdent("column name").value);
    while (this.peek().type === TokenType.Comma) {
      this.next();
      cols.push(this.expectIdent("column name").value);
    }
    this.expect(TokenType.RParen, "')'");
    return cols;
  }
  // Operation 생성(id/timestamp 채움)
  mkOp(type, params) {
    return { id: generateId(), type, timestamp: 0, params };
  }
};
function parse(input) {
  return new Parser(input).parse();
}

// src/features/migration/mig-dsl/serializer.ts
var INDENT = "  ";
function serializeColumnDef(c) {
  const parts = [String(c.name), String(c.dataType)];
  if (c.isPrimaryKey) parts.push("primary key");
  if (c.autoIncrement) parts.push("auto_increment");
  if (c.nullable === false) parts.push("not null");
  else if (c.nullable === true) parts.push("null");
  if (c.isUnique) parts.push("unique");
  if (c.defaultValue != null) parts.push(`default ${String(c.defaultValue)}`);
  return parts.join(" ");
}
function qname(name, schema) {
  return schema ? `${String(schema)}.${String(name)}` : String(name);
}
function refAction2(a) {
  return String(a).toLowerCase();
}
function serializeOp(op) {
  const p = op.params;
  switch (op.type) {
    case "createTable": {
      const cols = p.columns ?? [];
      const header = `create table ${qname(p.name, p.schema)} (`;
      const colLines = cols.map((c) => `${INDENT}${INDENT}${serializeColumnDef(c)};`);
      return `${header}
${colLines.join("\n")}
${INDENT});`;
    }
    case "addColumn": {
      const flags = [];
      if (p.nullable === false) flags.push("not null");
      if (p.isUnique) flags.push("unique");
      if (p.autoIncrement) flags.push("auto_increment");
      if (p.defaultValue != null) flags.push(`default ${String(p.defaultValue)}`);
      const tail = flags.length ? ` ${flags.join(" ")}` : "";
      return `alter table ${String(p.table)} add column ${String(p.name)} ${String(p.dataType)}${tail};`;
    }
    case "dropColumn":
      return `alter table ${String(p.table)} drop column ${String(p.name)};`;
    case "renameColumn":
      return `alter table ${String(p.table)} rename column ${String(p.oldName)} to ${String(p.newName)};`;
    case "modifyColumnType":
      return `alter table ${String(p.table)} alter column ${String(p.column)} ${String(p.newType)};`;
    case "dropTable":
      return `drop table ${qname(p.name, p.schema)};`;
    case "renameTable":
      return `rename table ${String(p.oldName)} to ${String(p.newName)};`;
    case "addForeignKey": {
      const cols = p.columns.join(", ");
      const refCols = p.refColumns.join(", ");
      let s = `add fk ${String(p.name)} on ${String(p.table)} ( ${cols} ) -> ${String(p.refTable)} ( ${refCols} )`;
      s += ` on delete ${refAction2(p.onDelete)} on update ${refAction2(p.onUpdate)}`;
      return `${s};`;
    }
    case "dropForeignKey":
      return `drop fk ${String(p.name)} on ${String(p.table)};`;
    case "createIndex": {
      const cols = p.columns.join(", ");
      const uniq = p.unique ? "unique " : "";
      return `create ${uniq}index ${String(p.name)} on ${String(p.table)} ( ${cols} );`;
    }
    case "dropIndex":
      return `drop index ${String(p.name)} on ${String(p.table)};`;
    // raw 는 OperationType 에 없으므로 문자열 비교로 처리
    default:
      if (op.type === "raw") {
        return `raw '${String(p.sql)}';`;
      }
      throw new Error(`serialize: unsupported operation type '${op.type}'`);
  }
}
function serializeBlockBody(ops) {
  return ops.map((op) => {
    const text = serializeOp(op);
    return text.split("\n").map((line, i) => i === 0 ? `${INDENT}${line}` : line).join("\n");
  }).join("\n");
}
function serialize(ops, opts = {}) {
  const upBody = serializeBlockBody(ops);
  let out = `up {
${upBody}
}`;
  if (opts.omitDown) return out;
  let downOps = opts.downOps;
  if (!downOps || downOps.length === 0) {
    downOps = [];
    for (let i = ops.length - 1; i >= 0; i--) {
      const inv = generateInverse(ops[i]);
      if (inv) downOps.push(inv);
    }
  }
  if (downOps.length > 0) {
    const downBody = serializeBlockBody(downOps);
    out += `
down {
${downBody}
}`;
  }
  return out;
}

// src/features/migration/mig-dsl/index.ts
function parseMig(text) {
  const { ops, downOps, warnings } = parse(text);
  return { ops, downOps, warnings };
}
function serializeMig(ops, opts = {}) {
  return serialize(ops, opts);
}
function lintMig(text) {
  try {
    parse(text);
    return { errors: [] };
  } catch (e) {
    const err = e;
    const line = typeof err.line === "number" ? err.line : 1;
    const col = typeof err.col === "number" ? err.col : 1;
    const message = (err.message ?? "parse error").replace(/\s*\(line \d+, col \d+\)\s*$/, "");
    return { errors: [{ line, col, message }] };
  }
}

// src/features/migration/operations/executor.ts
function applyOperation(schema, op) {
  const next = structuredClone(schema);
  const p = op.params;
  switch (op.type) {
    case "createTable": {
      const id = generateId();
      const columns = p.columns ?? [];
      next.tables[id] = {
        id,
        name: p.name,
        schema: p.schema,
        columns: columns.map((c) => ({
          id: c.id ?? generateId(),
          name: c.name,
          dataType: c.dataType,
          nullable: c.nullable ?? true,
          autoIncrement: c.autoIncrement ?? false,
          isPrimaryKey: c.isPrimaryKey ?? false,
          isUnique: c.isUnique ?? false,
          defaultValue: c.defaultValue,
          comment: c.comment,
          length: c.length,
          precision: c.precision,
          scale: c.scale,
          enumValues: c.enumValues
        })),
        indexes: [],
        comment: p.comment,
        engine: p.engine,
        charset: p.charset
      };
      break;
    }
    case "dropTable": {
      const tableId = Object.keys(next.tables).find(
        (id) => next.tables[id].name === p.name
      );
      if (tableId) {
        delete next.tables[tableId];
        for (const [relId, rel] of Object.entries(next.relationships)) {
          if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
            delete next.relationships[relId];
          }
        }
      }
      break;
    }
    case "renameTable": {
      const entry = Object.values(next.tables).find(
        (t) => t.name === p.oldName
      );
      if (entry) entry.name = p.newName;
      break;
    }
    case "addColumn": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        table.columns.push({
          id: generateId(),
          name: p.name,
          dataType: p.dataType ?? "VARCHAR",
          nullable: p.nullable ?? true,
          autoIncrement: p.autoIncrement ?? false,
          isPrimaryKey: p.isPrimaryKey ?? false,
          isUnique: p.isUnique ?? false,
          defaultValue: p.defaultValue
        });
      }
      break;
    }
    case "dropColumn": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        table.columns = table.columns.filter((c) => c.name !== p.name);
      }
      break;
    }
    case "renameColumn": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.oldName);
        if (col) col.name = p.newName;
      }
      break;
    }
    case "modifyColumnType": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.column);
        if (col) col.dataType = p.newType;
      }
      break;
    }
    case "modifyColumnDefault": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.column);
        if (col) col.defaultValue = p.newDefault;
      }
      break;
    }
    case "setColumnNullable": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.column);
        if (col) col.nullable = p.nullable;
      }
      break;
    }
    case "setColumnAutoIncrement": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.column);
        if (col) col.autoIncrement = p.autoIncrement;
      }
      break;
    }
    case "setColumnUnique": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const col = table.columns.find((c) => c.name === p.column);
        if (col) col.isUnique = p.unique;
      }
      break;
    }
    case "addPrimaryKey": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const colNames = p.columns;
        for (const col of table.columns) {
          if (colNames.includes(col.name)) col.isPrimaryKey = true;
        }
      }
      break;
    }
    case "dropPrimaryKey": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const colNames = p.columns;
        for (const col of table.columns) {
          if (colNames.includes(col.name)) col.isPrimaryKey = false;
        }
      }
      break;
    }
    case "addForeignKey": {
      const id = generateId();
      const fkTable = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      const refTable = Object.values(next.tables).find(
        (t) => t.name === p.refTable
      );
      if (fkTable && refTable) {
        const fkColIds = p.columns.map((name) => fkTable.columns.find((c) => c.name === name)?.id).filter((id2) => id2 != null);
        const refColIds = p.refColumns.map((name) => refTable.columns.find((c) => c.name === name)?.id).filter((id2) => id2 != null);
        next.relationships[id] = {
          id,
          name: p.name,
          sourceTableId: refTable.id,
          // 참조/PK 테이블
          targetTableId: fkTable.id,
          // FK 보유 테이블
          type: "1:N",
          sourceColumnIds: refColIds,
          // PK 컬럼
          targetColumnIds: fkColIds,
          // FK 컬럼
          onDelete: p.onDelete,
          onUpdate: p.onUpdate
        };
      }
      break;
    }
    case "dropForeignKey": {
      const relId = Object.keys(next.relationships).find(
        (id) => next.relationships[id].name === p.name
      );
      if (relId) delete next.relationships[relId];
      break;
    }
    case "addUniqueConstraint": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const colNames = p.columns;
        if (colNames.length === 1) {
          const col = table.columns.find((c) => c.name === colNames[0]);
          if (col) col.isUnique = true;
        } else {
          const colIds = colNames.map((name) => table.columns.find((c) => c.name === name)?.id).filter((id) => id != null);
          const indexName = p.name ?? `uq_${table.name}_${colNames.join("_")}`;
          table.indexes.push({
            id: generateId(),
            name: indexName,
            columnIds: colIds,
            unique: true
          });
        }
      }
      break;
    }
    case "dropUniqueConstraint": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        table.indexes = table.indexes.filter((idx) => idx.name !== p.name);
        const cols = p.columns;
        if (cols && cols.length === 1) {
          const col = table.columns.find((c) => c.name === cols[0]);
          if (col) col.isUnique = false;
        }
      }
      break;
    }
    case "createIndex": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        const colIds = p.columns.map((name) => table.columns.find((c) => c.name === name)?.id).filter((id) => id != null);
        table.indexes.push({
          id: generateId(),
          name: p.name,
          columnIds: colIds,
          unique: p.unique
        });
      }
      break;
    }
    case "dropIndex": {
      const table = Object.values(next.tables).find(
        (t) => t.name === p.table
      );
      if (table) {
        table.indexes = table.indexes.filter((idx) => idx.name !== p.name);
      }
      break;
    }
  }
  return next;
}

// src/features/migration/diff.ts
function mkOp(type, params) {
  return { id: generateId(), type, timestamp: 0, params };
}
function columnParams(c) {
  const out = {
    name: c.name,
    dataType: c.dataType,
    nullable: c.nullable,
    isPrimaryKey: c.isPrimaryKey,
    isUnique: c.isUnique,
    autoIncrement: c.autoIncrement
  };
  if (c.defaultValue != null) out.defaultValue = c.defaultValue;
  if (c.length != null) out.length = c.length;
  if (c.precision != null) out.precision = c.precision;
  if (c.scale != null) out.scale = c.scale;
  return out;
}
function columnDefEqual(a, b) {
  return a.dataType === b.dataType && (a.nullable ?? true) === (b.nullable ?? true) && (a.isPrimaryKey ?? false) === (b.isPrimaryKey ?? false) && (a.isUnique ?? false) === (b.isUnique ?? false) && (a.autoIncrement ?? false) === (b.autoIncrement ?? false) && (a.defaultValue ?? null) === (b.defaultValue ?? null);
}
function diffColumns(tableName, before, after) {
  const ops = [];
  const afterById = new Map(after.columns.map((c) => [c.id, c]));
  const beforeByName = new Map(before.columns.map((c) => [c.name, c]));
  const afterByName = new Map(after.columns.map((c) => [c.name, c]));
  const matchedBeforeIds = /* @__PURE__ */ new Set();
  const matchedAfterIds = /* @__PURE__ */ new Set();
  for (const bc of before.columns) {
    const ac = afterById.get(bc.id);
    if (!ac) continue;
    matchedBeforeIds.add(bc.id);
    matchedAfterIds.add(ac.id);
    if (bc.name !== ac.name) {
      ops.push(mkOp("renameColumn", { table: tableName, oldName: bc.name, newName: ac.name }));
    }
    if (bc.dataType !== ac.dataType) {
      ops.push(mkOp("modifyColumnType", { table: tableName, column: ac.name, oldType: bc.dataType, newType: ac.dataType }));
    }
    const nameAligned = { ...bc, name: ac.name };
    if (!columnDefEqual(nameAligned, ac)) {
      ops.push(mkOp("dropColumn", { table: tableName, name: ac.name }));
      ops.push(mkOp("addColumn", { table: tableName, ...columnParams(ac) }));
    }
  }
  for (const ac of after.columns) {
    if (matchedAfterIds.has(ac.id)) continue;
    if (beforeByName.has(ac.name)) {
      const bc = beforeByName.get(ac.name);
      if (bc.dataType !== ac.dataType) {
        ops.push(mkOp("modifyColumnType", { table: tableName, column: ac.name, oldType: bc.dataType, newType: ac.dataType }));
      }
      if (!columnDefEqual(bc, ac)) {
        ops.push(mkOp("dropColumn", { table: tableName, name: ac.name }));
        ops.push(mkOp("addColumn", { table: tableName, ...columnParams(ac) }));
      }
      matchedBeforeIds.add(bc.id);
    } else {
      ops.push(mkOp("addColumn", { table: tableName, ...columnParams(ac) }));
    }
  }
  for (const bc of before.columns) {
    if (matchedBeforeIds.has(bc.id)) continue;
    if (!afterByName.has(bc.name)) {
      ops.push(mkOp("dropColumn", { table: tableName, name: bc.name }));
    }
  }
  return ops;
}
function diffIndexes(tableName, before, after) {
  const ops = [];
  const colName = (t, id) => t.columns.find((c) => c.id === id)?.name;
  const beforeNames = new Set(before.indexes.map((i) => i.name));
  const afterNames = new Set(after.indexes.map((i) => i.name));
  for (const idx of after.indexes) {
    if (beforeNames.has(idx.name)) continue;
    const columns = idx.columnIds.map((id) => colName(after, id)).filter((n) => n != null);
    if (columns.length === 0) continue;
    ops.push(mkOp("createIndex", { table: tableName, name: idx.name, columns, unique: idx.unique }));
  }
  for (const idx of before.indexes) {
    if (afterNames.has(idx.name)) continue;
    ops.push(mkOp("dropIndex", { table: tableName, name: idx.name }));
  }
  return ops;
}
function relToFkParams(rel, after) {
  const target = after.tables[rel.targetTableId];
  const source = after.tables[rel.sourceTableId];
  if (!target || !source) return null;
  const columns = rel.targetColumnIds.map((id) => target.columns.find((c) => c.id === id)?.name).filter((n) => n != null);
  const refColumns = rel.sourceColumnIds.map((id) => source.columns.find((c) => c.id === id)?.name).filter((n) => n != null);
  if (columns.length === 0 || refColumns.length === 0) return null;
  const name = rel.name ?? `fk_${target.name}_${columns[0]}`;
  return {
    name,
    table: target.name,
    columns,
    refTable: source.name,
    refColumns,
    onDelete: rel.onDelete,
    onUpdate: rel.onUpdate
  };
}
function relKey(rel, schema) {
  const s = schema.tables[rel.sourceTableId];
  const t = schema.tables[rel.targetTableId];
  const sName = s?.name ?? rel.sourceTableId;
  const tName = t?.name ?? rel.targetTableId;
  const sCols = rel.sourceColumnIds.map((id) => s?.columns.find((c) => c.id === id)?.name ?? id).sort().join(",");
  const tCols = rel.targetColumnIds.map((id) => t?.columns.find((c) => c.id === id)?.name ?? id).sort().join(",");
  return `${sName}(${sCols})->${tName}(${tCols})`;
}
function diffRelationships(before, after) {
  const ops = [];
  const beforeKeys = new Set(Object.values(before.relationships).map((r) => relKey(r, before)));
  const afterKeys = new Set(Object.values(after.relationships).map((r) => relKey(r, after)));
  for (const rel of Object.values(after.relationships)) {
    if (beforeKeys.has(relKey(rel, after))) continue;
    const params = relToFkParams(rel, after);
    if (params) ops.push(mkOp("addForeignKey", params));
  }
  for (const rel of Object.values(before.relationships)) {
    if (afterKeys.has(relKey(rel, before))) continue;
    const target = before.tables[rel.targetTableId];
    if (!target) continue;
    const columns = rel.targetColumnIds.map((id) => target.columns.find((c) => c.id === id)?.name).filter((n) => n != null);
    const name = rel.name ?? `fk_${target.name}_${columns[0] ?? "x"}`;
    ops.push(mkOp("dropForeignKey", { table: target.name, name }));
  }
  return ops;
}
function diffSchemas(before, after) {
  const created = [];
  const altered = [];
  const dropped = [];
  const beforeTables = Object.values(before.tables);
  const afterTables = Object.values(after.tables);
  const afterById = new Map(afterTables.map((t) => [t.id, t]));
  const beforeByName = new Map(beforeTables.map((t) => [t.name, t]));
  const afterByName = new Map(afterTables.map((t) => [t.name, t]));
  const matchedBeforeIds = /* @__PURE__ */ new Set();
  const matchedAfterIds = /* @__PURE__ */ new Set();
  for (const bt of beforeTables) {
    const at = afterById.get(bt.id);
    if (!at) continue;
    matchedBeforeIds.add(bt.id);
    matchedAfterIds.add(at.id);
    if (bt.name !== at.name) {
      altered.push(mkOp("renameTable", { oldName: bt.name, newName: at.name }));
    }
    altered.push(...diffColumns(at.name, bt, at));
    altered.push(...diffIndexes(at.name, bt, at));
  }
  for (const at of afterTables) {
    if (matchedAfterIds.has(at.id)) continue;
    const bt = beforeByName.get(at.name);
    if (bt && !matchedBeforeIds.has(bt.id)) {
      matchedBeforeIds.add(bt.id);
      altered.push(...diffColumns(at.name, bt, at));
      altered.push(...diffIndexes(at.name, bt, at));
    } else {
      created.push(mkOp("createTable", { name: at.name, columns: at.columns.map(columnParams), ...at.schema ? { schema: at.schema } : {} }));
      altered.push(...diffIndexes(at.name, { ...at, indexes: [] }, at));
    }
  }
  for (const bt of beforeTables) {
    if (matchedBeforeIds.has(bt.id)) continue;
    if (!afterByName.has(bt.name)) {
      dropped.push(mkOp("dropTable", { name: bt.name }));
    }
  }
  const rels = diffRelationships(before, after);
  return [...created, ...altered, ...dropped, ...rels];
}

// src/plugin/commands.ts
function snapshotSchema(store) {
  const s = store.getState();
  return { tables: s.tables, relationships: s.relationships, layers: {} };
}
function compactColumn(c) {
  const flags = [];
  if (c.isPrimaryKey) flags.push("PK");
  if (c.isUnique) flags.push("UQ");
  if (!c.nullable) flags.push("NN");
  if (c.autoIncrement) flags.push("AI");
  return { name: c.name, type: c.dataType, flags };
}
function compactTable(t) {
  return { name: t.name, columns: t.columns.map(compactColumn) };
}
function deepSnapshot(store) {
  const s = store.getState();
  return {
    tables: structuredClone(s.tables),
    relationships: structuredClone(s.relationships)
  };
}
function restoreSnapshot(store, snap) {
  store.getState().loadProject({
    tables: structuredClone(snap.tables),
    relationships: structuredClone(snap.relationships)
  });
}
function loadParsedSchema(store, parsed, mode) {
  if (mode === "replace") store.getState().clearSchema();
  store.getState().loadSchema(parsed.tables, parsed.relationships);
  return {
    tables: Object.keys(parsed.tables).length,
    relationships: Object.keys(parsed.relationships).length
  };
}
var EMPTY_SCHEMA = { tables: {}, relationships: {}, layers: {} };
function pad2(n) {
  return String(n).padStart(2, "0");
}
function nowStamp(d = /* @__PURE__ */ new Date()) {
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return { date, time };
}
function migFilename(existingCount, d = /* @__PURE__ */ new Date()) {
  const { date, time } = nowStamp(d);
  const seq = String(existingCount + 1).padStart(3, "0");
  return `migration_${date}_${time}_${seq}.mig`;
}
function joinPath(dir, file) {
  return dir.endsWith("/") ? `${dir}${file}` : `${dir}/${file}`;
}
function migFileContent(name, ops) {
  const body = serializeMig(ops);
  return name ? `-- name: ${name}
${body}` : body;
}
function parseMigName(text) {
  const m = text.match(/^\s*--\s*name:\s*(.+?)\s*$/m);
  return m ? m[1] : void 0;
}
function extractMigNames(listing) {
  const children = listing?.children ?? [];
  return children.filter((c) => c && c.dir !== true && typeof c.name === "string" && c.name.endsWith(".mig")).map((c) => c.name).sort();
}
function errMsg(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
async function resolveMigId(fs, dir, id) {
  if (!fs.list) return id;
  let files;
  try {
    files = extractMigNames(await fs.list(dir));
  } catch {
    return id;
  }
  if (files.includes(id)) return id;
  const withExt = id.endsWith(".mig") ? id : `${id}.mig`;
  if (files.includes(withExt)) return withExt;
  const stem = id.endsWith(".mig") ? id.slice(0, -4) : id;
  const byStem = files.find((f) => f.slice(0, -4) === stem);
  return byStem ?? null;
}
async function buildBaseline(fs, dir) {
  if (!fs.list || !fs.readText) throw new Error("fs \uAD8C\uD55C \uD544\uC694");
  const listing = await fs.list(dir);
  const files = extractMigNames(listing);
  let schema = EMPTY_SCHEMA;
  const ops = [];
  for (const file of files) {
    const { text } = await fs.readText(joinPath(dir, file));
    const { ops: up } = parseMig(text);
    for (const op of up) {
      ops.push(op);
      schema = applyOperation(schema, op);
    }
  }
  return { schema, files, ops };
}
function registerCommands(ctx, store) {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);
  const internal = /* @__PURE__ */ new Map();
  const add = (name, description, handler, params) => {
    const wrapped = async (p) => handler(p ?? {});
    internal.set(name, wrapped);
    ctx.subscriptions.push(register(name, { description, params, handler: wrapped }));
  };
  add("get-schema", "\uC2A4\uD0A4\uB9C8 \uC870\uD68C(mode: compact \uC694\uC57D | full \uC6D0\uBCF8)", (p) => {
    const mode = p.mode === "full" ? "full" : "compact";
    if (mode === "full") {
      return { ok: true, mode, schema: snapshotSchema(store) };
    }
    const tablesMap = store.getState().tables;
    const tables = Object.values(tablesMap).map(compactTable);
    const relationships = Object.values(store.getState().relationships).map((r) => ({
      type: r.type,
      source: tablesMap[r.sourceTableId]?.name ?? r.sourceTableId,
      target: tablesMap[r.targetTableId]?.name ?? r.targetTableId
    }));
    return { ok: true, mode, tables, relationships };
  }, {
    mode: { type: "string", enum: ["compact", "full"], description: "\uC870\uD68C \uD615\uC2DD(compact \uC694\uC57D | full \uC6D0\uBCF8)", default: "compact" }
  });
  add("list-tables", "\uD14C\uC774\uBE14 \uBAA9\uB85D(id/name/\uCEEC\uB7FC\uC218)", () => {
    const tables = Object.values(store.getState().tables).map((t) => ({
      id: t.id,
      name: t.name,
      columnCount: t.columns.length
    }));
    return { ok: true, tables };
  });
  add("get-table", "\uD14C\uC774\uBE14 \uB2E8\uAC74 \uC870\uD68C(\uC774\uB984/ id)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, table: r.table };
  }, {
    table: { type: "string", required: true, description: "\uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" }
  });
  add("get-columns", "\uD14C\uC774\uBE14 \uCEEC\uB7FC \uBAA9\uB85D", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, columns: r.table.columns };
  }, {
    table: { type: "string", required: true, description: "\uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" }
  });
  add("list-relationships", "\uAD00\uACC4 \uBAA9\uB85D", () => {
    const relationships = Object.values(store.getState().relationships);
    return { ok: true, relationships };
  });
  add("validate", "\uC2A4\uD0A4\uB9C8 \uBB34\uACB0\uC131 \uAC80\uC0AC(\uC774\uC288 \uBC30\uC5F4)", () => {
    const issues = validateSchema(snapshotSchema(store));
    return { ok: true, issues };
  });
  add("stats", "\uC2A4\uD0A4\uB9C8 \uD1B5\uACC4(\uD14C\uC774\uBE14/\uCEEC\uB7FC/\uAD00\uACC4 \uC218)", () => {
    const tables = Object.values(store.getState().tables);
    const columnCount = tables.reduce((acc, t) => acc + t.columns.length, 0);
    return {
      ok: true,
      stats: {
        tableCount: tables.length,
        columnCount,
        relationshipCount: Object.keys(store.getState().relationships).length
      }
    };
  });
  add("diff", "\uAE30\uC900 \uC2A4\uD0A4\uB9C8(from)\uC640 \uD604\uC7AC\uC758 added/removed \uD14C\uC774\uBE14 \uBCF4\uACE0", (p) => {
    const from = p.from;
    if (!from || typeof from !== "object" || !from.tables) {
      return { ok: false, error: "diff requires { from: ERDSchema }" };
    }
    const fromNames = new Set(Object.values(from.tables).map((t) => t.name));
    const nowNames = new Set(Object.values(store.getState().tables).map((t) => t.name));
    const addedTables = [...nowNames].filter((n) => !fromNames.has(n));
    const removedTables = [...fromNames].filter((n) => !nowNames.has(n));
    return { ok: true, diff: { addedTables, removedTables } };
  }, {
    from: { type: "json", required: true, description: "\uAE30\uC900 \uC2A4\uD0A4\uB9C8(ERDSchema: { tables, relationships, layers })" }
  });
  add("create-table", "\uD14C\uC774\uBE14 \uC0DD\uC131(ifNotExists \uBA71\uB4F1)", (p) => {
    if (!p.name || typeof p.name !== "string") return { ok: false, error: "name required" };
    const existing = Object.values(store.getState().tables).find(
      (t) => t.name.toLowerCase() === p.name.toLowerCase()
    );
    if (existing) {
      if (p.ifNotExists) return { ok: true, id: existing.id, noop: true };
      return { ok: false, error: `table already exists: '${p.name}'` };
    }
    const id = store.getState().addTable({
      name: p.name,
      columns: p.columns,
      comment: p.comment,
      schema: p.schema
    });
    return { ok: true, id };
  }, {
    name: { type: "string", required: true, description: "\uC0DD\uC131\uD560 \uD14C\uC774\uBE14 \uC774\uB984" },
    columns: { type: "json", description: "\uCD08\uAE30 \uCEEC\uB7FC \uC815\uC758 \uBC30\uC5F4(Column[] \uBD80\uBD84 \uD615\uD0DC)" },
    comment: { type: "string", description: "\uD14C\uC774\uBE14 \uC8FC\uC11D" },
    schema: { type: "string", description: "\uC18C\uC18D \uC2A4\uD0A4\uB9C8(\uB124\uC784\uC2A4\uD398\uC774\uC2A4)" },
    ifNotExists: { type: "boolean", description: "\uB3D9\uBA85 \uD14C\uC774\uBE14\uC774 \uC788\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("rename-table", "\uD14C\uC774\uBE14 \uC774\uB984 \uBCC0\uACBD", (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== "string") return { ok: false, error: "name required" };
    store.getState().updateTable(r.id, { name: p.name });
    return { ok: true, id: r.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    name: { type: "string", required: true, description: "\uBCC0\uACBD\uD560 \uC0C8 \uC774\uB984" }
  });
  add("drop-table", "\uD14C\uC774\uBE14 \uC0AD\uC81C(ifExists \uBA71\uB4F1)", (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) {
      if (p.ifExists) return { ok: true, noop: true };
      return r;
    }
    store.getState().removeTable(r.id);
    return { ok: true, id: r.id };
  }, {
    table: { type: "string", required: true, description: "\uC0AD\uC81C\uD560 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    ifExists: { type: "boolean", description: "\uC5C6\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("add-column", "\uCEEC\uB7FC \uCD94\uAC00(ifNotExists \uBA71\uB4F1)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== "string") return { ok: false, error: "name required" };
    const exists = r.table.columns.find((c) => c.name.toLowerCase() === p.name.toLowerCase());
    if (exists) {
      if (p.ifNotExists) return { ok: true, columnId: exists.id, noop: true };
      return { ok: false, error: `column already exists: '${p.name}'` };
    }
    store.getState().addColumn(r.id, {
      name: p.name,
      dataType: p.dataType,
      nullable: p.nullable,
      isPrimaryKey: p.isPrimaryKey,
      isUnique: p.isUnique,
      autoIncrement: p.autoIncrement,
      defaultValue: p.defaultValue,
      comment: p.comment,
      length: p.length
    });
    const created = store.getState().tables[r.id].columns.find((c) => c.name === p.name);
    return { ok: true, columnId: created?.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    name: { type: "string", required: true, description: "\uCD94\uAC00\uD560 \uCEEC\uB7FC \uC774\uB984" },
    dataType: { type: "string", description: "\uB370\uC774\uD130 \uD0C0\uC785(\uC608: INT, VARCHAR)" },
    nullable: { type: "boolean", description: "NULL \uD5C8\uC6A9 \uC5EC\uBD80" },
    isPrimaryKey: { type: "boolean", description: "PK \uC5EC\uBD80" },
    isUnique: { type: "boolean", description: "UNIQUE \uC5EC\uBD80" },
    autoIncrement: { type: "boolean", description: "\uC790\uB3D9 \uC99D\uAC00 \uC5EC\uBD80" },
    defaultValue: { type: "string", description: "\uAE30\uBCF8\uAC12" },
    comment: { type: "string", description: "\uCEEC\uB7FC \uC8FC\uC11D" },
    length: { type: "number", description: "\uAE38\uC774(\uC608: VARCHAR(n))" },
    ifNotExists: { type: "boolean", description: "\uB3D9\uBA85 \uCEEC\uB7FC\uC774 \uC788\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("update-column", "\uCEEC\uB7FC \uC18D\uC131 \uBCC0\uACBD", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const updates = {};
    for (const k of ["name", "dataType", "nullable", "isPrimaryKey", "isUnique", "autoIncrement", "defaultValue", "comment", "length", "precision", "scale"]) {
      if (p[k] !== void 0) updates[k] = p[k];
    }
    store.getState().updateColumn(r.id, cr.id, updates);
    return { ok: true, columnId: cr.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    column: { type: "string", required: true, description: "\uB300\uC0C1 \uCEEC\uB7FC \uC774\uB984 \uB610\uB294 id" },
    name: { type: "string", description: "\uBCC0\uACBD\uD560 \uCEEC\uB7FC \uC774\uB984" },
    dataType: { type: "string", description: "\uB370\uC774\uD130 \uD0C0\uC785" },
    nullable: { type: "boolean", description: "NULL \uD5C8\uC6A9 \uC5EC\uBD80" },
    isPrimaryKey: { type: "boolean", description: "PK \uC5EC\uBD80" },
    isUnique: { type: "boolean", description: "UNIQUE \uC5EC\uBD80" },
    autoIncrement: { type: "boolean", description: "\uC790\uB3D9 \uC99D\uAC00 \uC5EC\uBD80" },
    defaultValue: { type: "string", description: "\uAE30\uBCF8\uAC12" },
    comment: { type: "string", description: "\uCEEC\uB7FC \uC8FC\uC11D" },
    length: { type: "number", description: "\uAE38\uC774" },
    precision: { type: "number", description: "\uC815\uBC00\uB3C4(precision)" },
    scale: { type: "number", description: "\uC18C\uC218 \uC790\uB9BF\uC218(scale)" }
  });
  add("drop-column", "\uCEEC\uB7FC \uC0AD\uC81C(ifExists \uBA71\uB4F1)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) {
      if (p.ifExists) return { ok: true, noop: true };
      return cr;
    }
    store.getState().removeColumn(r.id, cr.id);
    return { ok: true, columnId: cr.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    column: { type: "string", required: true, description: "\uC0AD\uC81C\uD560 \uCEEC\uB7FC \uC774\uB984 \uB610\uB294 id" },
    ifExists: { type: "boolean", description: "\uC5C6\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("reorder-columns", "\uCEEC\uB7FC \uC21C\uC11C \uC7AC\uBC30\uC5F4(\uC774\uB984/ id \uBC30\uC5F4)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns)) return { ok: false, error: "columns array required" };
    const ids = [];
    for (const arg of p.columns) {
      const cr = resolveColumn(r.table, arg);
      if (!cr.ok) return cr;
      ids.push(cr.id);
    }
    store.getState().reorderColumns(r.id, ids);
    return { ok: true };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    columns: { type: "json", required: true, description: "\uC7AC\uBC30\uC5F4\uD560 \uCEEC\uB7FC \uC774\uB984/ id \uBC30\uC5F4(\uC6D0\uD558\uB294 \uC21C\uC11C)" }
  });
  add("set-pk", "\uCEEC\uB7FC PK \uC124\uC815/\uD574\uC81C", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === void 0 ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, value ? { isPrimaryKey: true, nullable: false } : { isPrimaryKey: false });
    return { ok: true };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    column: { type: "string", required: true, description: "\uB300\uC0C1 \uCEEC\uB7FC \uC774\uB984 \uB610\uB294 id" },
    value: { type: "boolean", description: "PK \uC124\uC815(true, \uAE30\uBCF8)/\uD574\uC81C(false)" }
  });
  add("set-unique", "\uCEEC\uB7FC UNIQUE \uC124\uC815/\uD574\uC81C", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === void 0 ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, { isUnique: value });
    return { ok: true };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    column: { type: "string", required: true, description: "\uB300\uC0C1 \uCEEC\uB7FC \uC774\uB984 \uB610\uB294 id" },
    value: { type: "boolean", description: "UNIQUE \uC124\uC815(true, \uAE30\uBCF8)/\uD574\uC81C(false)" }
  });
  add("add-index", "\uC778\uB371\uC2A4 \uCD94\uAC00(\uCEEC\uB7FC \uC774\uB984/ id \uBC30\uC5F4, ifNotExists \uBA71\uB4F1)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns) || p.columns.length === 0) {
      return { ok: false, error: "columns array required" };
    }
    const columnIds = [];
    for (const arg of p.columns) {
      const cr = resolveColumn(r.table, arg);
      if (!cr.ok) return cr;
      columnIds.push(cr.id);
    }
    const name = p.name ?? `idx_${r.table.name}_${columnIds.length}`;
    if (p.ifNotExists && r.table.indexes.some((i) => i.name === name)) {
      return { ok: true, noop: true };
    }
    const indexId = generateId();
    store.getState().updateTable(r.id, {
      indexes: [...r.table.indexes, { id: indexId, name, columnIds, unique: !!p.unique, type: p.type }]
    });
    return { ok: true, indexId };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    columns: { type: "json", required: true, description: "\uC778\uB371\uC2A4 \uAD6C\uC131 \uCEEC\uB7FC \uC774\uB984/ id \uBC30\uC5F4" },
    name: { type: "string", description: "\uC778\uB371\uC2A4 \uC774\uB984(\uC0DD\uB7B5 \uC2DC \uC790\uB3D9 \uC0DD\uC131)" },
    unique: { type: "boolean", description: "UNIQUE \uC778\uB371\uC2A4 \uC5EC\uBD80" },
    type: { type: "string", description: "\uC778\uB371\uC2A4 \uC885\uB958(\uC608: BTREE, HASH)" },
    ifNotExists: { type: "boolean", description: "\uB3D9\uBA85 \uC778\uB371\uC2A4\uAC00 \uC788\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("drop-index", "\uC778\uB371\uC2A4 \uC0AD\uC81C(\uC774\uB984/ id, ifExists \uBA71\uB4F1)", (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const idx = r.table.indexes.find((i) => i.name === p.index || i.id === p.index);
    if (!idx) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, error: `index not found: '${p.index}'` };
    }
    store.getState().updateTable(r.id, {
      indexes: r.table.indexes.filter((i) => i.id !== idx.id)
    });
    return { ok: true, indexId: idx.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    index: { type: "string", required: true, description: "\uC0AD\uC81C\uD560 \uC778\uB371\uC2A4 \uC774\uB984 \uB610\uB294 id" },
    ifExists: { type: "boolean", description: "\uC5C6\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("add-relationship", "FK \uAD00\uACC4 \uCD94\uAC00(source=\uCC38\uC870PK\xB7target=FK\uBCF4\uC720, autoFk \uC2DC FK \uCEEC\uB7FC \uC790\uB3D9 \uC0DD\uC131)", (p) => {
    const sr = getTable(store, p.source);
    if (!sr.ok) return sr;
    const tr = getTable(store, p.target);
    if (!tr.ok) return tr;
    const type = p.type ?? "1:N";
    const srcPk = sr.table.columns.find((c) => c.isPrimaryKey) ?? sr.table.columns[0];
    if (!srcPk) return { ok: false, error: `source table '${sr.table.name}' has no columns to reference` };
    let targetColumnIds = [];
    if (Array.isArray(p.targetColumns) && p.targetColumns.length > 0) {
      for (const arg of p.targetColumns) {
        const cr = resolveColumn(tr.table, arg);
        if (!cr.ok) return cr;
        targetColumnIds.push(cr.id);
      }
    } else if (p.autoFk) {
      const fkName = `${sr.table.name}_${srcPk.name}`;
      const existing = tr.table.columns.find((c) => c.name.toLowerCase() === fkName.toLowerCase());
      let fkId;
      if (existing) {
        fkId = existing.id;
      } else {
        store.getState().addColumn(tr.id, {
          name: fkName,
          dataType: srcPk.dataType,
          nullable: type !== "1:1",
          isPrimaryKey: false,
          isUnique: type === "1:1",
          autoIncrement: false
        });
        fkId = store.getState().tables[tr.id].columns.find((c) => c.name === fkName).id;
      }
      targetColumnIds = [fkId];
    }
    const rel = {
      name: p.name,
      sourceTableId: sr.id,
      targetTableId: tr.id,
      type,
      sourceColumnIds: [srcPk.id],
      targetColumnIds,
      onDelete: p.onDelete ?? "NO ACTION",
      onUpdate: p.onUpdate ?? "NO ACTION"
    };
    const id = store.getState().addRelationship(rel);
    return { ok: true, id };
  }, {
    source: { type: "string", required: true, description: "\uCC38\uC870 \uB300\uC0C1(PK \uBCF4\uC720) \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    target: { type: "string", required: true, description: "FK \uBCF4\uC720 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    type: { type: "string", enum: ["1:1", "1:N", "N:M"], description: "\uAD00\uACC4 \uCE74\uB514\uB110\uB9AC\uD2F0", default: "1:N" },
    targetColumns: { type: "json", description: "target \uC758 FK \uCEEC\uB7FC \uC774\uB984/ id \uBC30\uC5F4(\uBA85\uC2DC \uC2DC autoFk \uBB34\uC2DC)" },
    autoFk: { type: "boolean", description: "target \uC5D0 <source>_<pk> FK \uCEEC\uB7FC \uC790\uB3D9 \uC0DD\uC131" },
    name: { type: "string", description: "\uAD00\uACC4(\uC81C\uC57D) \uC774\uB984" },
    onDelete: { type: "string", enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"], description: "ON DELETE \uB3D9\uC791", default: "NO ACTION" },
    onUpdate: { type: "string", enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"], description: "ON UPDATE \uB3D9\uC791", default: "NO ACTION" }
  });
  add("update-relationship", "\uAD00\uACC4 \uC18D\uC131 \uBCC0\uACBD", (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      return { ok: false, error: `relationship not found: '${p.id}'` };
    }
    const updates = {};
    for (const k of ["name", "type", "onDelete", "onUpdate", "lineStyle"]) {
      if (p[k] !== void 0) updates[k] = p[k];
    }
    store.getState().updateRelationship(p.id, updates);
    return { ok: true, id: p.id };
  }, {
    id: { type: "string", required: true, description: "\uB300\uC0C1 \uAD00\uACC4 id" },
    name: { type: "string", description: "\uAD00\uACC4 \uC774\uB984" },
    type: { type: "string", enum: ["1:1", "1:N", "N:M"], description: "\uAD00\uACC4 \uCE74\uB514\uB110\uB9AC\uD2F0" },
    onDelete: { type: "string", enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"], description: "ON DELETE \uB3D9\uC791" },
    onUpdate: { type: "string", enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"], description: "ON UPDATE \uB3D9\uC791" },
    lineStyle: { type: "string", enum: ["dashed", "solid"], description: "\uAD00\uACC4 \uC120 \uC2A4\uD0C0\uC77C" }
  });
  add("drop-relationship", "\uAD00\uACC4 \uC0AD\uC81C(ifExists \uBA71\uB4F1)", (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, error: `relationship not found: '${p.id}'` };
    }
    store.getState().removeRelationship(p.id);
    return { ok: true, id: p.id };
  }, {
    id: { type: "string", required: true, description: "\uC0AD\uC81C\uD560 \uAD00\uACC4 id" },
    ifExists: { type: "boolean", description: "\uC5C6\uC73C\uBA74 noop(\uBA71\uB4F1)" }
  });
  add("set-color", "\uD14C\uC774\uBE14 \uC0C9\uC0C1 \uC124\uC815(null \uB85C \uD574\uC81C)", (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    store.getState().updateTable(r.id, { color: p.color ?? void 0 });
    return { ok: true, id: r.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    color: { type: "string", description: "\uC0C9\uC0C1(\uC608: #RRGGBB). \uC0DD\uB7B5/null \uC774\uBA74 \uD574\uC81C" }
  });
  add("apply", "\uBC30\uCE58 \uC2E4\uD589({ops,atomic,title}). atomic \uBD80\uBD84 \uC2E4\uD328 \uC2DC \uC2A4\uB0C5\uC0F7 \uBCF5\uC6D0", async (p) => {
    const ops = p.ops;
    if (!Array.isArray(ops)) return { ok: false, error: "ops array required" };
    const atomic = p.atomic !== false;
    const before = atomic ? deepSnapshot(store) : null;
    const results = [];
    let failedAt = -1;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const h = internal.get(op.command);
      let res;
      if (!h) {
        res = { ok: false, error: `unknown command in batch: '${op.command}'` };
      } else {
        res = await h(op.params ?? {});
      }
      results.push(res);
      if (!res.ok && failedAt === -1) failedAt = i;
      if (!res.ok && atomic) break;
    }
    const anyFailed = results.some((r) => !r.ok);
    if (anyFailed && atomic && before) {
      restoreSnapshot(store, before);
      return {
        ok: false,
        error: `batch failed at op ${failedAt}: ${results[failedAt].error}`,
        failedAt,
        rolledBack: true,
        results
      };
    }
    if (anyFailed) {
      return { ok: false, error: "batch completed with failures", failedAt, results };
    }
    if (p.title && typeof store.getState().commitVersion === "function") {
      try {
        store.getState().commitVersion(p.title);
      } catch {
      }
    }
    return { ok: true, results };
  }, {
    ops: { type: "json", required: true, description: "\uC2E4\uD589\uD560 \uC791\uC5C5 \uBC30\uC5F4([{ command, params }])" },
    atomic: { type: "boolean", description: "\uBD80\uBD84 \uC2E4\uD328 \uC2DC \uC2DC\uC791 \uC2A4\uB0C5\uC0F7\uC73C\uB85C \uC804\uCCB4 \uBCF5\uC6D0(\uAE30\uBCF8 true)", default: true },
    title: { type: "string", description: "\uC131\uACF5 \uC2DC \uCEE4\uBC0B\uD560 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC81C\uBAA9" }
  });
  add("undo", "\uB9C8\uC9C0\uB9C9 \uBBF8\uCEE4\uBC0B \uC791\uC5C5 \uB418\uB3CC\uB9AC\uAE30(\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC2AC\uB77C\uC774\uC2A4 \uAE30\uBC18)", () => {
    const fn = store.getState().undoLastOperation;
    if (typeof fn !== "function") return { ok: false, error: "undo not available" };
    const inverse = fn();
    return { ok: true, inverse };
  });
  add("redo", "\uB418\uB3CC\uB9B0 \uC791\uC5C5 \uB2E4\uC2DC \uC801\uC6A9(P3/P4 \uD1B5\uD569 \uC608\uC815 stub)", () => {
    return { ok: true, noop: true, todo: "redo wiring deferred to P3/P4" };
  });
  add("auto-layout", "\uC790\uB3D9 \uBC30\uCE58(dagre \uAE30\uBC18 \uC88C\uD45C \uACC4\uC0B0\xB7\uC801\uC6A9)", (p) => {
    const schema = snapshotSchema(store);
    const positions = computeAutoLayout(schema, store.getState().nodePositions, {
      direction: p.direction ?? "TB"
    });
    store.getState().setNodePositions(positions);
    return { ok: true, count: Object.keys(positions).length };
  }, {
    direction: { type: "string", enum: ["TB", "LR", "BT", "RL"], description: "\uBC30\uCE58 \uBC29\uD5A5(dagre rankdir)", default: "TB" }
  });
  add("set-position", "\uD14C\uC774\uBE14 \uC88C\uD45C \uC124\uC815(\uC774\uB984/ id)", (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (typeof p.x !== "number" || typeof p.y !== "number") {
      return { ok: false, error: "x and y numbers required" };
    }
    store.getState().setNodePosition(r.id, { x: p.x, y: p.y });
    return { ok: true, id: r.id };
  }, {
    table: { type: "string", required: true, description: "\uB300\uC0C1 \uD14C\uC774\uBE14 \uC774\uB984 \uB610\uB294 id" },
    x: { type: "number", required: true, description: "x \uC88C\uD45C" },
    y: { type: "number", required: true, description: "y \uC88C\uD45C" }
  });
  add("get-viewport", "\uBDF0\uD3EC\uD2B8 \uC870\uD68C", () => {
    return { ok: true, viewport: store.getState().viewport };
  });
  add("set-viewport", "\uBDF0\uD3EC\uD2B8 \uC124\uC815(x/y/zoom)", (p) => {
    const v2 = store.getState().viewport;
    store.getState().setViewport({
      x: typeof p.x === "number" ? p.x : v2.x,
      y: typeof p.y === "number" ? p.y : v2.y,
      zoom: typeof p.zoom === "number" ? p.zoom : v2.zoom
    });
    return { ok: true, viewport: store.getState().viewport };
  }, {
    x: { type: "number", description: "\uBDF0\uD3EC\uD2B8 x(\uC0DD\uB7B5 \uC2DC \uD604\uC7AC \uC720\uC9C0)" },
    y: { type: "number", description: "\uBDF0\uD3EC\uD2B8 y(\uC0DD\uB7B5 \uC2DC \uD604\uC7AC \uC720\uC9C0)" },
    zoom: { type: "number", description: "\uC90C \uBC30\uC728(\uC0DD\uB7B5 \uC2DC \uD604\uC7AC \uC720\uC9C0)" }
  });
  add("select", "\uD14C\uC774\uBE14 \uC120\uD0DD(\uC774\uB984/ id \uBC30\uC5F4 \u2192 \uB178\uB4DC \uC120\uD0DD)", (p) => {
    const args = Array.isArray(p.tables) ? p.tables : [];
    const ids = [];
    for (const arg of args) {
      const r = resolveTable(store, arg);
      if (!r.ok) return r;
      ids.push(r.id);
    }
    store.getState().setSelectedNodeIds(ids);
    return { ok: true, selected: ids };
  }, {
    tables: { type: "json", description: "\uC120\uD0DD\uD560 \uD14C\uC774\uBE14 \uC774\uB984/ id \uBC30\uC5F4" }
  });
  add("export-sql", "SQL DDL \uC0DD\uC131(dialect \uC120\uD0DD: sqlite/mysql/postgresql)", (p) => {
    const dialect = p.dialect ?? "mysql";
    try {
      const sql = getDialect(dialect).generate(snapshotSchema(store));
      return { ok: true, sql };
    } catch (e) {
      return { ok: false, error: `export-sql failed: ${e.message}` };
    }
  }, {
    dialect: { type: "string", enum: ["sqlite", "mysql", "postgresql"], description: "\uB300\uC0C1 DB dialect", default: "mysql" }
  });
  add("import-sql", "SQL DDL \uD30C\uC2F1 \uD6C4 \uC801\uC7AC(dialect \uC120\uD0DD, mode: merge/replace)", (p) => {
    if (!p.text || typeof p.text !== "string") return { ok: false, error: "text required" };
    const dialect = p.dialect ?? "mysql";
    const mode = p.mode === "replace" ? "replace" : "merge";
    try {
      const { schema, warnings } = getDialect(dialect).parse(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-sql failed: ${e.message}` };
    }
  }, {
    text: { type: "string", required: true, description: "\uD30C\uC2F1\uD560 SQL DDL \uD14D\uC2A4\uD2B8" },
    dialect: { type: "string", enum: ["sqlite", "mysql", "postgresql"], description: "\uC785\uB825 DDL \uC758 dialect", default: "mysql" },
    mode: { type: "string", enum: ["merge", "replace"], description: "merge(\uAE30\uC874 \uC704 \uD569\uCE68) | replace(\uAE30\uC874 \uBE44\uC6B0\uACE0 \uC801\uC7AC)", default: "merge" }
  });
  add("export-dbml", "DBML \uC0DD\uC131(\uD604\uC7AC \uC2A4\uD0A4\uB9C8)", () => {
    try {
      return { ok: true, dbml: generateDbml(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-dbml failed: ${e.message}` };
    }
  });
  add("import-dbml", "DBML \uD30C\uC2F1 \uD6C4 \uC801\uC7AC(mode: merge/replace)", (p) => {
    if (!p.text || typeof p.text !== "string") return { ok: false, error: "text required" };
    const mode = p.mode === "replace" ? "replace" : "merge";
    try {
      const { schema, warnings } = parseDbml(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-dbml failed: ${e.message}` };
    }
  }, {
    text: { type: "string", required: true, description: "\uD30C\uC2F1\uD560 DBML \uD14D\uC2A4\uD2B8" },
    mode: { type: "string", enum: ["merge", "replace"], description: "merge(\uAE30\uC874 \uC704 \uD569\uCE68) | replace(\uAE30\uC874 \uBE44\uC6B0\uACE0 \uC801\uC7AC)", default: "merge" }
  });
  add("export-prisma", "Prisma \uC2A4\uD0A4\uB9C8 \uC0DD\uC131(\uD604\uC7AC \uC2A4\uD0A4\uB9C8)", () => {
    try {
      return { ok: true, prisma: generatePrisma(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-prisma failed: ${e.message}` };
    }
  });
  add("import-prisma", "Prisma \uC2A4\uD0A4\uB9C8 \uD30C\uC2F1 \uD6C4 \uC801\uC7AC(mode: merge/replace)", (p) => {
    if (!p.text || typeof p.text !== "string") return { ok: false, error: "text required" };
    const mode = p.mode === "replace" ? "replace" : "merge";
    try {
      const { schema, warnings } = parsePrisma(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-prisma failed: ${e.message}` };
    }
  }, {
    text: { type: "string", required: true, description: "\uD30C\uC2F1\uD560 Prisma \uC2A4\uD0A4\uB9C8 \uD14D\uC2A4\uD2B8" },
    mode: { type: "string", enum: ["merge", "replace"], description: "merge(\uAE30\uC874 \uC704 \uD569\uCE68) | replace(\uAE30\uC874 \uBE44\uC6B0\uACE0 \uC801\uC7AC)", default: "merge" }
  });
  add("export-mermaid", "Mermaid erDiagram \uC0DD\uC131(\uD604\uC7AC \uC2A4\uD0A4\uB9C8)", () => {
    try {
      return { ok: true, mermaid: generateMermaid(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-mermaid failed: ${e.message}` };
    }
  });
  add("import-mermaid", "Mermaid erDiagram \uD30C\uC2F1 \uD6C4 \uC801\uC7AC(mode: merge/replace)", (p) => {
    if (!p.text || typeof p.text !== "string") return { ok: false, error: "text required" };
    const mode = p.mode === "replace" ? "replace" : "merge";
    try {
      const schema = parseMermaid(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings: [] };
    } catch (e) {
      return { ok: false, error: `import-mermaid failed: ${e.message}` };
    }
  }, {
    text: { type: "string", required: true, description: "\uD30C\uC2F1\uD560 Mermaid erDiagram \uD14D\uC2A4\uD2B8" },
    mode: { type: "string", enum: ["merge", "replace"], description: "merge(\uAE30\uC874 \uC704 \uD569\uCE68) | replace(\uAE30\uC874 \uBE44\uC6B0\uACE0 \uC801\uC7AC)", default: "merge" }
  });
  const fs = ctx.app.fs;
  const needFs = () => fs ? null : { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
  const requireDir = (p) => typeof p.dir === "string" && p.dir.length > 0 ? null : { ok: false, error: "dir(\uC808\uB300\uACBD\uB85C) required" };
  add("migration-status", "\uB300\uAE30 \uBCC0\uACBD \uBBF8\uB9AC\uBCF4\uAE30(\uBCA0\uC774\uC2A4\uB77C\uC778 vs \uD604\uC7AC working store diff)", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    try {
      const { schema: baseline, files } = await buildBaseline(fs, p.dir);
      const ops = diffSchemas(baseline, snapshotSchema(store));
      return {
        ok: true,
        applied: files.length,
        appliedFiles: files,
        pendingOps: ops.length,
        ops,
        clean: ops.length === 0
      };
    } catch (e) {
      return { ok: false, error: `migration-status \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" }
  });
  add("migration-generate", "\uBCA0\uC774\uC2A4\uB77C\uC778\u2192\uD604\uC7AC diff \uB85C .mig \uC0DD\uC131(confirm \uC5C6\uC73C\uBA74 preview, confirm=true \uBA74 \uD30C\uC77C \uAE30\uB85D)", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    try {
      const { schema: baseline, files } = await buildBaseline(fs, p.dir);
      const ops = diffSchemas(baseline, snapshotSchema(store));
      if (ops.length === 0) return { ok: true, noop: true };
      const mig = migFileContent(p.name, ops);
      if (!p.confirm) {
        return { ok: true, preview: true, mig, ops };
      }
      if (!fs.writeText) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
      const filename = migFilename(files.length);
      const path = joinPath(p.dir, filename);
      await fs.writeText(path, mig);
      return { ok: true, written: true, filename, path, ops };
    } catch (e) {
      return { ok: false, error: `migration-generate \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" },
    name: { type: "string", description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC774\uB984 \uBA54\uD0C0(\uD30C\uC77C\uC5D0 -- name: \uC73C\uB85C \uAE30\uB85D)" },
    confirm: { type: "boolean", description: "true \uBA74 \uD30C\uC77C \uAE30\uB85D, \uC0DD\uB7B5 \uC2DC \uBBF8\uB9AC\uBCF4\uAE30(mig/ops \uB9CC)" }
  });
  add("migration-list", "\uB514\uB809\uD1A0\uB9AC\uC758 .mig \uD30C\uC77C \uBAA9\uB85D(\uC774\uB984\uC21C)", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    if (!fs.list) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
    try {
      const listing = await fs.list(p.dir);
      const files = extractMigNames(listing);
      return { ok: true, files, count: files.length };
    } catch (e) {
      return { ok: false, error: `migration-list \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" }
  });
  add("migration-show", "\uB2E8\uC77C .mig \uD30C\uC77C \uB0B4\uC6A9\xB7\uD30C\uC2F1 \uACB0\uACFC \uC870\uD68C", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    if (!p.id || typeof p.id !== "string") return { ok: false, error: "id(\uD30C\uC77C\uBA85) required" };
    if (!fs.readText) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
    try {
      const file = await resolveMigId(fs, p.dir, p.id);
      if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
      const { text } = await fs.readText(joinPath(p.dir, file));
      const { ops, downOps, warnings } = parseMig(text);
      return { ok: true, id: file, name: parseMigName(text), text, ops, downOps, warnings };
    } catch (e) {
      return { ok: false, error: `migration-show \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" },
    id: { type: "string", required: true, description: ".mig \uD30C\uC77C\uBA85(\uD655\uC7A5\uC790 \uC0DD\uB7B5 \uAC00\uB2A5)" }
  });
  add("migration-sql", "\uB2E8\uC77C .mig \uC758 up ops \u2192 \uD574\uB2F9 dialect DDL \uC0DD\uC131", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    if (!p.id || typeof p.id !== "string") return { ok: false, error: "id(\uD30C\uC77C\uBA85) required" };
    if (!fs.readText) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
    const dialect = p.dialect ?? "mysql";
    if (dialect !== "mysql" && dialect !== "postgresql") {
      return { ok: false, error: `migration-sql dialect \uBBF8\uC9C0\uC6D0: '${dialect}'(mysql|postgresql)` };
    }
    try {
      const file = await resolveMigId(fs, p.dir, p.id);
      if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
      const { text } = await fs.readText(joinPath(p.dir, file));
      const { ops, downOps } = parseMig(text);
      const gen = getSQLGenerator(dialect);
      return { ok: true, id: file, dialect, up: gen.generateBatch(ops), down: gen.generateBatch(downOps) };
    } catch (e) {
      return { ok: false, error: `migration-sql \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" },
    id: { type: "string", required: true, description: ".mig \uD30C\uC77C\uBA85(\uD655\uC7A5\uC790 \uC0DD\uB7B5 \uAC00\uB2A5)" },
    dialect: { type: "string", enum: ["mysql", "postgresql"], description: "\uB300\uC0C1 DB dialect", default: "mysql" }
  });
  add("migration-apply", ".mig \uC758 up ops \uB97C working store \uC5D0 \uC801\uC6A9(id \uC0DD\uB7B5 \uC2DC dir \uC804\uCCB4 fold)", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    if (!fs.readText || !fs.list) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
    try {
      let ops;
      if (p.id && typeof p.id === "string") {
        const file = await resolveMigId(fs, p.dir, p.id);
        if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
        const { text } = await fs.readText(joinPath(p.dir, file));
        ops = parseMig(text).ops;
      } else {
        ops = (await buildBaseline(fs, p.dir)).ops;
      }
      let schema = snapshotSchema(store);
      for (const op of ops) schema = applyOperation(schema, op);
      loadParsedSchema(store, schema, "replace");
      return { ok: true, applied: ops.length };
    } catch (e) {
      return { ok: false, error: `migration-apply \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" },
    id: { type: "string", description: ".mig \uD30C\uC77C\uBA85(\uD655\uC7A5\uC790 \uC0DD\uB7B5 \uAC00\uB2A5, \uC0DD\uB7B5 \uC2DC dir \uC804\uCCB4 \uBCA0\uC774\uC2A4\uB77C\uC778 \uC801\uC6A9)" }
  });
  add("migration-revert", ".mig \uC758 down ops \uB97C working store \uC5D0 \uC801\uC6A9(\uC5ED\uC5F0\uC0B0 \u2014 id \uC0DD\uB7B5 \uC2DC \uB9C8\uC9C0\uB9C9 \uD30C\uC77C)", async (p) => {
    const g = needFs();
    if (g) return g;
    const d = requireDir(p);
    if (d) return d;
    if (!fs.readText || !fs.list) return { ok: false, error: "fs \uAD8C\uD55C \uD544\uC694" };
    try {
      let id;
      if (typeof p.id === "string") {
        id = await resolveMigId(fs, p.dir, p.id);
        if (!id) return { ok: false, error: `migration not found: '${p.id}'` };
      } else {
        const files = extractMigNames(await fs.list(p.dir));
        if (files.length === 0) return { ok: true, noop: true };
        id = files[files.length - 1];
      }
      const { text } = await fs.readText(joinPath(p.dir, id));
      const { downOps } = parseMig(text);
      let schema = snapshotSchema(store);
      for (const op of downOps) schema = applyOperation(schema, op);
      loadParsedSchema(store, schema, "replace");
      return { ok: true, reverted: downOps.length, id };
    } catch (e) {
      return { ok: false, error: `migration-revert \uC2E4\uD328: ${errMsg(e)}` };
    }
  }, {
    dir: { type: "string", required: true, description: "\uB9C8\uC774\uADF8\uB808\uC774\uC158 \uB514\uB809\uD1A0\uB9AC(\uC808\uB300\uACBD\uB85C)" },
    id: { type: "string", description: ".mig \uD30C\uC77C\uBA85(\uD655\uC7A5\uC790 \uC0DD\uB7B5 \uAC00\uB2A5, \uC0DD\uB7B5 \uC2DC \uAC00\uC7A5 \uCD5C\uC2E0 \uD30C\uC77C)" }
  });
  add("migration-lint", ".mig \uD14D\uC2A4\uD2B8 \uBB38\uBC95 \uAC80\uC99D(\uC5D0\uB7EC \uBAA9\uB85D, fs \uBD88\uC694)", (p) => {
    if (typeof p.text !== "string") return { ok: false, error: "text required" };
    const { errors } = lintMig(p.text);
    return { ok: true, errors, valid: errors.length === 0 };
  }, {
    text: { type: "string", required: true, description: "\uAC80\uC99D\uD560 .mig \uD14D\uC2A4\uD2B8" }
  });
}

// src/plugin-entry.tsx
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var roots = /* @__PURE__ */ new WeakMap();
var plugin_entry_default = {
  activate(ctx) {
    const app = ctx.app;
    ctx.subscriptions.push(
      app.ui.registerView("canvas", {
        mount(container) {
          const root = (0, import_client.createRoot)(container);
          root.render(
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--fg, #ddd)",
                  background: "var(--bg, #1e1e1e)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 14
                },
                children: "ERD plugin loaded \u2713 \u2014 P0a \uBC88\uB4E4 \uB9C8\uC6B4\uD2B8(React-in-blob)"
              }
            )
          );
          roots.set(container, root);
        },
        unmount(container) {
          const r = roots.get(container);
          if (r) {
            r.unmount();
            roots.delete(container);
          }
        }
      })
    );
    if (app.commands?.register) {
      ctx.subscriptions.push(
        app.commands.register("ping", {
          description: "\uD50C\uB7EC\uADF8\uC778 \uC801\uC7AC/\uBC84\uC804 \uD655\uC778(E2E)",
          handler: async () => ({
            ok: true,
            plugin: "soksak-plugin-erd",
            version: "0.1.0",
            phase: "P2"
          })
        })
      );
    }
    registerCommands(ctx, useStore2);
  },
  deactivate() {
  }
};
export {
  plugin_entry_default as default
};
