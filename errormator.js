  var ErrorReporter, Errormator, Logger, doPost, http, os, url;

  url = require('url');

  http = require('https');

  os = require("os");

  doPost = function(options, data) {
    var req;

    options.method = "POST";
    options.headers['Content-Length'] = data.length;
    options.headers['Content-Type'] = 'application/json';
    req = http.request(options, function(res) {
      console.log(res.statusCode);
      return res.on('data', function(d) {
        return process.stdout.write(d);
      });
    });
    req.write(data);
    return req.end();
  };

  Logger = (function() {
    function Logger(app, namespace, request) {
      this.app = app;
      this.namespace = namespace;
      this.request = request;
    }

    Logger.prototype.log = function(level, message, date) {
      var obj, options;

      if (date == null) {
        date = new Date();
      }
      obj = {
        log_level: level,
        message: message,
        namespace: this.namespace,
        request_id: this.request.id(),
        server: os.hostname(),
        date: date
      };
      options = url.parse(this.app.log_url);
      options.headers = this.app.getHeaders();
      return doPost(options, JSON.stringify([obj]));
    };

    Logger.prototype.info = function(message, date) {
      return this.log("INFO", message, date);
    };

    Logger.prototype.debug = function(message, date) {
      return this.log("DEBUG", message, date);
    };

    Logger.prototype.warn = function(message, date) {
      return this.log("WARN", message, date);
    };

    Logger.prototype.error = function(message, date) {
      return this.log("ERROR", message, date);
    };

    return Logger;

  })();

  ErrorReporter = (function() {
    function ErrorReporter(app, options) {
      this.app = app;
      this.options = options;
    }

    ErrorReporter.prototype.addReport = function(request, message) {
      var data;

      data = {
        url: request.url,
        ip: request.connection.remoteAddress,
        start_time: new Date(request.time()),
        user_agent: request.headers['user-agent'],
        message: message,
        request_id: request.id(),
        request: {
          REQUEST_METHOD: request.method,
          PATH_INFO: request.path()
        }
      };
      this.options.report_details.push(data);
      return this.send();
    };

    ErrorReporter.prototype.send = function() {
      var opt;

      opt = url.parse(this.app.report_url);
      opt.headers = this.app.getHeaders();
      return doPost(opt, JSON.stringify([this.options]));
    };

    return ErrorReporter;

  })();

  Errormator = (function() {
    function Errormator(config) {
      this.key = config.api_key;
      this.log_url = config.logUrl || "https://api.errormator.com/api/logs?protocol_version=0.3";
      this.report_url = config.reportUrl || "https://api.errormator.com/api/reports?protocol_version=0.3";
      this.slow_url = config.slowUrl || "https://api.errormator.com/api/slow_reports?protocol_version=0.3";
    }

    Errormator.prototype.getLogger = function(namespace, request) {
      return new Logger(this, namespace, request);
    };

    Errormator.prototype.getHeaders = function() {
      return {
        "X-errormator-api-key": this.key
      };
    };

    Errormator.prototype.getReporter = function(priority, errorType, status, traceback) {
      var options;

      options = {
        client: "javascript_server",
        server: os.hostname(),
        priority: priority,
        error_type: errorType,
        traceback: traceback,
        http_status: status,
        report_details: []
      };
      return new ErrorReporter(this, options);
    };

    return Errormator;

  })();

  module.exports = Errormator;