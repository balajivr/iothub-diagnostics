'use strict';

const logger = require('../lib').logger;
const config = require('../config');
const dns = require('dns');
const https = require('https');
const ping = require('ping');
const Traceroute = require('nodejs-traceroute');

function dnsResolve(domain, done) {
  logger.info('');
  logger.info("Starting DNS resolution for host '" + domain + "'..." );
  dns.resolve4(domain, function(err, addresses) {
    if (err) {
      logger.crit("--> Failed to resolve host, error: " + err.code);
      return done(err);
    } else {
      logger.info('--> Successfully resolved DNS to ' + addresses[0] + '.' );
      return done(null, addresses[0]);
    }
  });
}

function pingIpv4Address(ipv4Address, done) {
  logger.info('');
  logger.info("Pinging IPV4 address '" + ipv4Address + "'...");
  ping.sys.probe(ipv4Address, function(isAlive) {
    if (!isAlive) {
      var errMsg = 'Failed to ping ' + ipv4Address;
      logger.crit ('--> ' + errMsg);
      done(new Error(errMsg));
    } else {
      logger.info('--> Successfully pinged ' + ipv4Address);
      done();
    }
  });
}

function traceRoute(ipv4Address, done) {
  var tracer = new Traceroute();
  var hopCount = 0;
  logger.info('');
  logger.info("Traceroute on IPV4 address '" + ipv4Address + "'...");
  try {
    tracer
      .on('hop', function(hop) {
        logger.info('Hop: ' + JSON.stringify(hop));
        hopCount++;
      })
      .on('close', function(exitCode) {
        if (exitCode === 0) {
          logger.info('--> Successfully ran traceroute on ' + ipv4Address + ': ' + hopCount + ' hops.');
          done(null, hopCount);
        } else {
          logger.crit ('--> Failed to trace ' + ipv4Address);
          done(new Error('failed after ' + hopCount + ' hops'));
        }
      });
    tracer.trace(ipv4Address);
  } catch (err) {
    logger.crit ('--> Failed to traceroute: ' + err.message);
    done(err);
  }
}

function httpsRequest(done) {
  logger.info('');
  logger.info("Sending https request to '" + config.httpsRequestUrl + "'");

  var req = https.get(config.httpsRequestUrl, (res) => {
    res.on('data', (d) =>
    {
        logger.info('--> Completed https request');
        return done(null);
    });
  });
  
  req.on('error', (e) => {
      logger.warn('--> Failed to make https request.');
      logger.debug(e);
      return done(e);
  });

  req.end();
}

function run(done) { 
  var domain = config.pingUrl;
  dnsResolve(domain, function(err, ipAddress) {
    if (err) {
      return done(err);
    } else {
      logger.debug(JSON.stringify(domain) + ' using address: ' + ipAddress);
      pingIpv4Address(ipAddress, function (err) {
        if (err) {
          return done(err);
        } else {
          traceRoute(ipAddress, function (err) {
            if (err) {
              return done(err);
            } else {
              return httpsRequest(done);
            }
          });
        }
      });
    }
  })
}

module.exports = {
  run: run
};