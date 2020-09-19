"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const github_1 = __importDefault(require("@actions/github"));
try {
    const nameToGreet = core_1.default.getInput('who-to-greet');
    console.log(`Hello ${nameToGreet}`);
    const time = new Date().toTimeString();
    core_1.default.setOutput("time", time);
    const payload = JSON.stringify(github_1.default.context.payload, undefined, 2);
    console.log(`Event payload: ${payload}`);
}
catch (err) {
    core_1.default.setFailed(err.message);
}
//# sourceMappingURL=actions.js.map