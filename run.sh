#!/bin/sh
gulp clean
gulp build
node build/server/app.js
