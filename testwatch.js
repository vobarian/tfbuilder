const fs = require('fs');
const child_process = require('child_process');

let jasmineRunning = false;

runJasmine();

fs.watch('./', { recursive: true }, runJasmine);

function runJasmine(o,filename) {    
    if (filename && (
            filename.startsWith('.git') ||
            !filename.endsWith('.js'))) return;
    
    if (jasmineRunning) return;

    jasmineRunning = true;
    const proc = child_process.fork('./node_modules/jasmine/bin/jasmine.js', [], {});
    proc.on('exit', () => {
        jasmineRunning = false;
    });
}
