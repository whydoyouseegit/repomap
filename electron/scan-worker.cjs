const { parentPort, workerData } = require('node:worker_threads');
const { analyze } = require('./analyzer.cjs');
analyze(workerData.root, progress => parentPort.postMessage({progress})).then(graph=>parentPort.postMessage({graph})).catch(error=>parentPort.postMessage({error:error.message}));
