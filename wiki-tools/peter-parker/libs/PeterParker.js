(function(exports) {
  'use strict';
  var jsdom = require('jsdom');
  var evts = require('events');
  var utils = require('./Utils.js');

  function PeterParker() {
    this._spawned = 0;
  }

  PeterParker.JQUERY_URL = "http://code.jquery.com/jquery.js";
  PeterParker.MAXIMUM_SPAWNED_CHILD = 1;
  PeterParker.SLEEP_TIMER = 1000;
  var proto = PeterParker.prototype;
  proto.__proto__ = evts.EventEmitter.prototype;

  proto._DEBUG = true;

  proto._debug = function pp__debug(msg) {
    if (!this._DEBUG) {
      return;
    }
    console.log('[' + (new Date()) + '] ' + msg);
  };

  proto.init = function pp_init(url) {
    var self = this;
    jsdom.env({
      url: url,
      scripts: [PeterParker.JQUERY_URL], // load jquery to help us.
      done: function jsdom_init_done(errors, window) {
        if (errors instanceof Error) {
          self.emit('error', errors);
        } else {
          self._window = window;
          self._$ = window.$;
          self.emit('ready');
        }
      }
    });
  };

  proto.queryLinks = function pp_queryLinks(context, selectors) {
    var ret = [];
    utils.query(this._$, context, selectors).each(function(idx, item) {
      if (item.href) {
        ret[ret.length] = item.href;
      }
    });
    return ret;
  };

  proto.queryLink = function pp_queryLink(context, selectors, index) {
    return this._getIndex('queryLinks', [context, selectors], index);
  };

  proto.queryAttrs = function pp_queryAttrs(context, selectors, attr) {
    var ret = [];
    var queryResult = utils.query(this._$, context, selectors);
    this._debug('query result: ' + queryResult.length);
    queryResult.each((function(idx, item) {
      if (item[attr]) {
        ret[ret.length] = item[attr];
      } else if (item.hasAttribute(attr)) {
        ret[ret.length] = item.getAttribute(attr).nodeValue;
      }
    }).bind(this));
    return ret;
  };

  proto.queryAttr = function pp_queryAttr(context, selectors, attr, index) {
    return this._getIndex('queryAttrs', [context, selectors, attr], index);
  };

  proto._getIndex = function pp__getIndex(query, args, index) {
    var got = this[query].apply(this, args);
    if (index < got.length && index > -1) {
      return got[index];
    } else {
      return null;
    }
  };

  proto._parseSingle = function pp__parseSingle(context, config) {
    var ret = {};
    for(var key in config) {
      this._debug('build field: ' + key);
      ret[key] = this.execute(context, config[key]);
      this._debug('field value: ' + ret[key]);
    }
    return ret;
  };

  proto._runPostCommands = function pp__post(result, prefetched, config) {
    for (var key in config) {
      if (config[key].type === 'parent-field') {
        result[key] = prefetched[config[key].field];
      }
    }
  };

  // TODO: write the sendPeterParker as a queue and limited by MAXIMUM_SPAWNED_CHILD.
  proto._sendPeterParker = function pp_sendChild(context, cmd) {
    var ret = {};
    var prefetched = {};
    for (var key in cmd) {
      switch(key) {
        case 'selector':
        case 'type':
        case 'config':
          continue;
        default:
          prefetched[key] = this.execute(context, cmd[key]);
      }
    }

    var self = this;
    var pp = new PeterParker();
    this._spawned++;
    pp.on('ready', function() {
      self._debug('spawn', 'peter parker is ready.');
      var childRet = pp.parse(cmd.config);
      utils.clone(childRet, ret);
      self._runPostCommands(ret, prefetched, cmd.config);
    });

    pp.on('done', function() {
      if (self._spawned === 0) {
        self.emit('done');
      } else {
        self._spawned--;
      }
    });

    pp.on('error', function(e) {
      self.emit('error', e);
    });
    this._debug('spawn, send another peter parker to ' + prefetched.url);
    pp.init(prefetched.url);
    return ret;
  }

  proto._spawnPeterParkers = function pp_spawn(context, cmd) {
    if (!context) {
      return this._sendPeterParker(context, cmd);
    }

    this._debug('spawn, context length: ' + context.length);
    var ret = [];
    context.each((function(index, item) {
      ret[ret.length] = this._sendPeterParker(item, cmd);
    }).bind(this));
    return ret;
  };

  proto.parse = function pp_parse(context, config) {
    if (!context) {
      setTimeout((function() {
        // we need to emit before done.
        if (this._spawned === 0) {
          this.emit('done');
        }
      }).bind(this));
      return this._parseSingle(context, config);
    }
    this._debug('parse, context length: ' + context.length);
    var ret = [];
    context.each((function(index, item) {
      ret[ret.length] = this._parseSingle(item, config);
    }).bind(this));

    setTimeout((function() {
      // we need to emit before done.
      if (this._spawned === 0) {
        this.emit('done');
      }
    }).bind(this));
    return ret;
  };

  proto.execute = function pp_execute(context, cmd) {
    switch(cmd.type) {
      case 'argv':
        return process.argv[cmd.index];
      case 'link':
        this._debug('query link: ' + context + ' ' + cmd.selector);
        return this.queryLink(context, cmd.selector, cmd.position || 0);
      case 'attr':
        this._debug('query attr: ' + context + ' ' + cmd.selector +
                    ', attr: ' + cmd.attr);
        return this.queryAttr(context, cmd.selector, cmd.attr, cmd.position || 0);
      case 'links':
        this._debug('query links: ' + context + ' ' + cmd.selector);
        return this.queryLinks(context, cmd.selector, cmd.position || 0);
      case 'attrs':
        this._debug('query attrs: ' + context + ' ' + cmd.selector +
                    ', attr: ' + cmd.attr);
        return this.queryAttrs(context, cmd.selector, cmd.attr, cmd.position || 0);
      case 'json-parser':
        this._debug('nested parser: ' + context + ' ' + cmd.selector);
        return this.parse(utils.query(this._$, context, cmd.selector),
               cmd.config);
      case 'peter-parker':
        this._debug('nested peter parker: ' + cmd.url);
        //var ctx = utils.query(this._$, context, cmd.selector);
        //return this._spawnPeterParkers(ctx, cmd);
        return null;
    }
  }

  exports.PeterParker = PeterParker;
}) (exports || window);
