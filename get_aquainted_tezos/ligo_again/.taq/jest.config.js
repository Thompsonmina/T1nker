
module.exports = {
    "automock": false,
    "bail": 0,
    "cache": true,
    "cacheDirectory": "/tmp/jest_rs",
    "changedFilesWithAncestor": false,
    "ci": false,
    "clearMocks": false,
    "collectCoverage": false,
    "coveragePathIgnorePatterns": [
        "/node_modules/"
    ],
    "coverageProvider": "babel",
    "coverageReporters": [
        "json",
        "text",
        "lcov",
        "clover"
    ],
    "detectLeaks": false,
    "detectOpenHandles": false,
    "errorOnDeprecated": false,
    "expand": false,
    "extensionsToTreatAsEsm": [],
    "fakeTimers": {
        "enableGlobally": false
    },
    "forceCoverageMatch": [],
    "haste": {
        "computeSha1": false,
        "enableSymlinks": false,
        "forceNodeFilesystemAPI": true,
        "throwOnModuleCollision": false
    },
    "injectGlobals": true,
    "listTests": false,
    "maxConcurrency": 5,
    "maxWorkers": "50%",
    "moduleDirectories": [
        "node_modules"
    ],
    "moduleFileExtensions": [
        "js",
        "mjs",
        "cjs",
        "jsx",
        "ts",
        "tsx",
        "json",
        "node"
    ],
    "moduleNameMapper": {},
    "modulePathIgnorePatterns": [],
    "noStackTrace": false,
    "notify": false,
    "notifyMode": "failure-change",
    "openHandlesTimeout": 1000,
    "passWithNoTests": false,
    "prettierPath": "prettier",
    "resetMocks": false,
    "resetModules": false,
    "restoreMocks": false,
    "roots": [
        "<rootDir>"
    ],
    "runTestsByPath": false,
    "runner": "jest-runner",
    "setupFiles": [],
    "setupFilesAfterEnv": [],
    "skipFilter": false,
    "slowTestThreshold": 5,
    "snapshotFormat": {
        "escapeString": false,
        "printBasicPrototype": false
    },
    "snapshotSerializers": [],
    "testEnvironment": "node",
    "testEnvironmentOptions": {},
    "testFailureExitCode": 1,
    "testLocationInResults": false,
    "testMatch": [
        "**/__tests__/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test).[tj]s?(x)"
    ],
    "testPathIgnorePatterns": [
        "/node_modules/"
    ],
    "testRegex": [],
    "testRunner": "jest-circus/runner",
    "testSequencer": "@jest/test-sequencer",
    "transform": {
        '^.+\\.tsx|js|jsx|ts|tsx?$': [
          'ts-jest',
          {
            useESM: true,
            esModuleInterop: true,
          }
        ]
      },
    "transformIgnorePatterns": [
        "/node_modules/",
        "\\.pnp\\.[^\\/]+$"
    ],
    "useStderr": false,
    "watch": false,
    "watchPathIgnorePatterns": [],
    "watchman": true,
    "workerThreads": false,
    "preset": "ts-jest"
}
