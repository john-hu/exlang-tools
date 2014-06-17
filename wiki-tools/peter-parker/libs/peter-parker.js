(function(exports) {
  'use strict';
  var jsdom = require('jsdom');
  var evts = require('events');
  var utils = require('./utils.js');
  var parsers = require('./parsers');

  function PeterParker() {
    this._unprocessed = [];
  }

  PeterParker.JQUERY_URL = "http://code.jquery.com/jquery.js";
  PeterParker.SLEEP_TIMER = 1000;
  var proto = PeterParker.prototype;
  proto.__proto__ = evts.EventEmitter.prototype;

  proto._DEBUG = false;

  proto._debug = function pp__debug(msg) {
    if (!this._DEBUG) {
      return;
    }
    this._info(msg);
  };

  proto._info = function pp__info(msg) {
    console.log('PeterParker - [' + (new Date()) + '] ' + msg);
  };

  proto.init = function pp_init(url) {
    this._info('send peter parker to ' + url);
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

  proto._processTask = function pp__process() {
    this._info('spawn, left tasks: ' + this._unprocessed.length);
    var task = this._unprocessed.pop();
    var self = this;
    var pp = new PeterParker();
    pp.on('ready', function() {
      self._debug('spawn, peter parker is ready.');
      task.result = pp.parse('', task.cmd.config);
    });

    pp.on('done', function() {
      // the result will always be object because we don't supply context to
      // parse function.
      utils.clone(task.result, task.ret);
      self._runPostCommands(task.ret, task.prefetched, task.cmd.config);
      if (self._unprocessed.length === 0) {
        self.emit('done');
      } else {
        self._debug('spawn, sleep ' + PeterParker.SLEEP_TIMER + ' ms for next');
        setTimeout(function() {
          self._processTask();
        }, PeterParker.SLEEP_TIMER)
      }
    });

    pp.on('error', function(e) {
      self.emit('error', e);
    });
    pp.init(task.prefetched.url);
  };

  // TODO: write the sendPeterParker as a queue and limited by MAXIMUM_SPAWNED_CHILD.
  proto._sendPeterParker = function pp_sendChild(context, cmd) {
    var task = {
      'prefetched': {},
      'cmd': cmd,
      'ret': {}
    };
    for (var key in cmd) {
      switch(key) {
        case 'selector':
        case 'type':
        case 'config':
          continue;
        default:
          task.prefetched[key] = this.execute(context, cmd[key]);
          this._debug('prefetch ' + key + ' = ' + task.prefetched[key]);
          break;
      }
    }

    this._unprocessed.push(task);
    return task.ret;
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
    var ret;
    if (!context) {
      ret = this._parseSingle(context, config);
    } else {
      this._debug('parse, context length: ' + context.length);
      ret = [];
      context.each((function(index, item) {
        ret[ret.length] = this._parseSingle(item, config);
      }).bind(this));
    }

    setTimeout((function() {
      // We need to emit 'done' after the return because of the timing issue.
      // The done should always be fired after the object returned.
      if (this._unprocessed.length === 0) {
        this.emit('done');
      } else {
        this._processTask();
      }
    }).bind(this));
    return ret;
  };

  proto.execute = function pp_execute(context, cmd) {
    switch(cmd.type) {
      case 'json-parser':
        this._debug('nested parser: ' + context + ' ' + cmd.selector);
        return this.parse(utils.query(this._$, context, cmd.selector),
               cmd.config);
      case 'peter-parker':
        this._debug('nested peter parker: ' + cmd.url);
        var ctx = utils.query(this._$, context, cmd.selector);
        return this._spawnPeterParkers(ctx, cmd);
      case 'parent-field':
        return; // we will fill this value at the parent of this peter parker.
      default:
        var parser = parsers.getParser(cmd.type);
        if (parser) {
          return parser.handle(this._$, context, cmd);
        }
    }
  }

  exports.PeterParker = PeterParker;
}) (exports || window);
