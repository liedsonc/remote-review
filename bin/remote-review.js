#!/usr/bin/env node
import { Command } from 'commander';
import getPort from 'get-port';
import crypto from 'node:crypto';
import process from 'node:process';

import { resolveDiff } from '../src/diff.js';
import { createServer } from '../server/index.js';
import { isCloudflaredAvailable, startTunnel, stopTunnel } from '../src/tunnel.js';
