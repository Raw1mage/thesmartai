#!/usr/bin/env bun

import { $ } from "bun"

await $`bun ./packages/sdk/js/script/build.ts`

await $`bun dev generate > ./packages/sdk/openapi.json`

await $`./scripts/format.ts`
