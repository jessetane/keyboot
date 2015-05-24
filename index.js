var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var defined = require('defined');
var has = require('has');
var RPC = require('frame-rpc');

module.exports = KB;
inherits(KB, EventEmitter);

function KB (href, opts) {
    var self = this;
    if (!(this instanceof KB)) return new KB(href, opts);
    EventEmitter.call(this);
    if (!opts) opts = {};
    
    var perms = defined(opts.permissions, []);
    this.href = /^https?:/.test(href) ? href : location.protocol + '//' + href;
    
    var methods = {
        emit: function () { self.emit.apply(self, arguments) }
    };
    
    this.frame = createIframe(this.href, function (frame) {
        var hrpc = RPC(window, frame.contentWindow, self.href, {
            hello: function (origin, cb) {
                cb(location.protocol + '//' + location.host);
                self.rpc = RPC(window, frame.contentWindow, self.href, methods);
                self.rpc.call('request', { permissions: perms });
            }
        });
        self.once('close', function () {
            hrpc.destroy();
        });
    });
    
    this.approved = false;
    this.on('approve', function () {
        self.approved = true;
    });
    this.on('revoke', function () {
        self.approved = false;
    });
    this.on('reject', function () {
        self.approved = false;
    });
}

KB.prototype.sign = defer(function (text, cb) {
    this.rpc.call('sign', text, cb);
});

KB.prototype.fingerprint = defer(function (cb) {
    this.rpc.call('fingerprint', cb);
});

KB.prototype.publicKey = defer(function (cb) {
    this.rpc.call('publicKey', cb);
});

KB.prototype.close = function () {
    document.body.removeChild(this.frame);
    this.emit('close');
};

function createIframe (src, cb) {
    var iframe = document.createElement('iframe');
    iframe.addEventListener('load', function () {
        cb(iframe);
    });
    iframe.setAttribute('src', src);
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    return iframe;
}

function defer (f) {
    return function () {
        var self = this;
        var args = arguments;
        if (self.approved) return g();
        self.once('approve', g);
        function g () { f.apply(self, args) }
    };
} 
