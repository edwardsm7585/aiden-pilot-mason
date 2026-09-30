20260930-160224 | phase0-scaffold | doctor=2 | upgrade-dry-run=2
20260930-160250 | phase0-scaffold | doctor=2 | upgrade-dry-run=1
20260930-162323 | phase0-doctor-green | doctor=0 | upgrade-dry-run=1
20260930-162356 | phase0-doctor-green | doctor=0 | upgrade-dry-run=0
20260930-163145 | phase0-deps-installed | doctor=0 | upgrade-dry-run=0
20260930-171146 | phase1-plan-approved | doctor=0 | upgrade-dry-run=0
20260930-171201 | phase2-data | doctor=0 | upgrade-dry-run=0
NOTE | 20260930-160224 phase0-scaffold | red baseline; upgrade skipped because the script's own doctor output dirtied the tree (script bug, fixed in dece6ee)
NOTE | 20260930-160250 phase0-scaffold | red baseline: aiden-cli 2.0.1 cannot parse the scaffold's aiden.config.ts (fixed in e3937a5; see .claude/fixes/aiden-cli.md)
NOTE | 20260930-162323 phase0-doctor-green | upgrade-dry-run=1: aiden-cli resolves "latest" via spawnSync("npm") which fails with ENOENT on Windows (worked around with --target in fbb40bd)
NOTE | 20260930-162356, 163145, 171146, 171201 | upgrade dry-run no-op reason: already on the latest published version (current 2.0.1 == target 2.0.1; 2.0.1 is the only aiden-* version on the feed), so no codemods or migrations were planned
20260930-171648 | phase2-loose-ends | doctor=0 | upgrade-dry-run=0
20260930-172451 | phase3-lib-wiring | doctor=0 | upgrade-dry-run=0
20260930-173244 | phase3-verified | doctor=0 | upgrade-dry-run=0
