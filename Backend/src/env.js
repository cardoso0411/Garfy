import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const backendEnv = fileURLToPath(new URL('../.env.backend', import.meta.url))
const defaultEnv = fileURLToPath(new URL('../.env', import.meta.url))
const envFile = existsSync(backendEnv) ? backendEnv : defaultEnv

if (existsSync(envFile)) dotenv.config({ path: envFile })
