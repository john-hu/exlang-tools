if (process.argv.length < 4) {
  console.log('please give us a url and config file which is a json file');
  process.exit(-1);
  return;
}

var config = require(process.argv[3]);

if (!config) {
  console.log('please give us a valid config file');
  process.exit(-2);
  return;
}

var pp = require('./libs/PeterParker.js');

var peter = new pp.PeterParker();
var parsed = null;

peter.on('ready', function() {
  parsed = peter.parse('', config);
});

peter.on('error', function(e) {
  console.error('error: ', e);
  process.exit(-3);
});

peter.on('done', function() {
  console.log(JSON.stringify(parsed));
});

peter.init(process.argv[2]);
