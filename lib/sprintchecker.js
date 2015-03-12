// SprintChecker runs in the browser and Node
(function() {
  'use strict';

  var isBrowser;
  var root = this;
  var prev_module = root.SprintChecker;
  var hasRequire = typeof require !== 'undefined';
  var hasModuleExports = false;
  var SprintChecker;
  var request;
  var Dots, dots, fs, file, user;
  var url = {
    dev: 'http://localhost:1337',
    prod: 'http://bookstrap.makersquare.com',
    api: '/api/v1/sprintchecker'
  };

  // Check to see what env we are in. Without this flag, SPrint checker will fail to work
  // in the browser and or node!
  if(typeof exports !== 'undefined') {
    isBrowser = false;
    if (typeof module !== 'undefined' && module.exports) {
      hasModuleExports = true;
    }
  } else {
    isBrowser = true;
  }

  // if running in the browser, continue as normal
  // root === window
  if (isBrowser) {
    var bookstrap = root.document.createElement('iframe');
    bookstrap.src = url.prod;
    bookstrap.style.display = 'none';
    bookstrap.name = 'bookstrap';

    root.addEventListener('DOMContentLoaded', function() {
      root.document.body.appendChild(bookstrap);
      root.addEventListener('message', function(e) {
        if (e.origin === url.prod) {
          root.alert(e.data);
        }
      });
    });


    // get access to the stando HTML reporter from the mocha instance
    // we need this to default to it otherwise we would have to create it all over again :(
    root.HTML_Reporter  = root.mocha._reporter;
    root.SprintChecker = function(runner) {
      var html = new root.HTML_Reporter(runner);

      // listen to the end event fired when all test are done and post results to bookstrap
      runner.on('end',function() {
        var results = {
          sprintSpecFailures: html.stats.failures,
          sprintSpecPasses: html.stats.passes,
          sprintSpecs: html.stats.tests
        };
        setTimeout(function() {
          var data = {
            data: results,
            secret: 'catreactor',
            url: url.prod + url.api
          };
          bookstrap.contentWindow.postMessage(data, url.prod);
        }, 3000);

      });
    };

    root.SprintChecker.noConflict = function() {
      root.SprintChecker = prev_module;
      return root.SprintChecker;
    };

  } else {
    // reference the stado process.exit to call it later
    // we must override it here because once process.exit is called
    // by mocha, you cannot stop it and cannot perform any async stuff since the
    // event loop has stopped.
    process.originalExit = process.exit;
    var options;

    if (hasRequire) {
      request = require('request');
      Dots = require('mocha').reporters.Dot;
      fs = require('fs');
    }

    process.exit = function(code) {
      request(options, function() {
        process.originalExit(code);
      });
    };

    // read .git/config to get github username
    // keep it seek for certainty
    try {
      file = fs.readFileSync('.git/config', 'utf-8');
    } catch(err) {
      // console.error(err);
    }

    SprintChecker = function(runner) {
      // parse contents of .git/config and get the current user github
      user = file.match(/(?!.*makersquare)(github.com)\W*\w*/g)[0].split('/')[1];
      options = {
        url: url.prod + url.api,
        method: "POST",
        headers: {
          "Content-Type": 'application/json; charset=UTF-8'
        }
      };
      // call the defaults Dots reporter and gain access to the stats
      dots = new Dots(runner);

      // send stats to bookstrap when test end
      runner.on('end', function() {
        var body = {
          sprintSpecFailures: dots.stats.failures,
          sprintSpecPasses: dots.stats.passes,
          sprintSpecs: dots.stats.tests,
          user: user
        };

        options.body = JSON.stringify(body);
      });
    };

    // export SprintChekcer so mocha can use it as a runner
    if (hasModuleExports) {
      exports = module.exports = SprintChecker;
    }

    exports.SprintChecker = SprintChecker;
  }
  // access window in browser || global in node
}).call(this);
