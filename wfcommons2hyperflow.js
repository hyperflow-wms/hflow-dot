#!/usr/bin/env node

var docopt   = require('docopt').docopt;

var doc = "\
hflow-convert-wfcommons: converts a Wf-Commons trace to HyperFlow workflow JSON format\n\
Usage:\n\
  hflow-convert-wfcommons <wfcommons-json-file-path>\n\
  hflow-convert-wfcommons -h|--help\n\
  \
Options:\n\
  -h --help   Prints this";

var opts = docopt(doc);

var file = opts['<wfcommons-json-file-path>'];

var fileContents = fs.readFileSync(file);

var wfCommons = JSON.parse(fileContents);

var wfOut = {
  name: wfCommons.name,
  processes: [],
  signals: [],
  ins: [],
  outs: []
}

var sigMap    = {};

function sigIdx(file) {
  if (sigMap[file.name]) {
    return sigMap[file.name];
  }
  let sigArrLength = wfOut.signals.push({
    name: file.name,
    size: file.size,
    hasSources: false,
    hasSinks: false
  });
  let sigIdx = sigArrLength-1;
  sigMap[file.name] = sigIdx;
  if (file.link == "input") { 
    wfOut.signals[sigIdx].hasSinks = true; // non-output file
  }
  if (file.link == "output") { 
    wfOut.signals[sigIdx].hasSources = true; // non-input file
  }
  return sigArrLength-1;
}

var wf = wfCommons.workflow;

// add info about machines
wfOut.machines = wfCommons.workflow.machines;
// add general trace info
wfOut.traceInfo = { makespan: wfCommons.workflow.makespan }

wf.jobs.forEach(function(wfJob) {
  let jobNameIdx = wfJob.name.lastIndexOf("_ID");
  if (jobNameIdx == -1) {
    jobNameIdx = wfJob.name.length;
  }
  let jobName = wfJob.name.slice(0, jobNameIdx); // trim "_IDxxxxx" suffix if exists
  let procArrLength = wfOut.processes.push({
    name: jobName,
    function: "{{function}}",
    firingLimit: 1,
    config: {},
    ins: [],
    outs: []
  });

  let procIdx = procArrLength-1;
  let procObj = wfOut.processes[procIdx];
  wfJob.files.forEach(function(file){
    if (file.link == "input") {
      procObj.ins.push(sigIdx(file));
    } else if (file.link = "output") {
      procObj.outs.push(sigIdx(file));
    } else {
      throw(new Error("Unknown file link"));
    }
  });

  procObj.config.executor = {
    executable: "unknown", // not logged in WfCommons
    args: wfJob.arguments,
    cpuRequest: wfJob.cores
  }

  procObj.config.traceInfo = {
    avgCPU: wfJob.avgCPU,
    bytesRead: wfJob.bytesRead,
    bytesWritten: wfJob.bytesWritten,
    memory: wfJob.memory,
    machine: wfJob.machine
  }
});

wfOut.signals.forEach(function(signal, idx) {
  if (!signal.hasSources) {
    wfOut.ins.push(idx);
    signal.data = [ {} ];
  }
  if (!signal.hasSinks) {
    wfOut.outs.push(idx);
  }
  delete signal.hasSources;
  delete signal.hasSinks;
});

console.log(JSON.stringify(wfOut, null, 2));
