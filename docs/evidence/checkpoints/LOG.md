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
20260930-173847 | phase4a-ticket-routes | doctor=0 | upgrade-dry-run=2
20260930-173859 | phase4a-ticket-routes | doctor=0 | upgrade-dry-run=0
NOTE | 20260930-173847 phase4a-ticket-routes | upgrade skipped: admin routes were still uncommitted; re-run 173859 on a clean tree is green
20260930-173913 | phase4b-admin-routes | doctor=0 | upgrade-dry-run=0
20260930-180537 | phase5-ui | doctor=0 | upgrade-dry-run=0
20260930-181749 | phase6a-after-provider-switch | doctor=0 | upgrade-dry-run=2
20260930-181752 | phase6b-after-audit-sink | doctor=0 | upgrade-dry-run=2
NOTE | 20260930-181749 phase6a / 181752 phase6b | upgrade skipped: next-env.d.ts flips between next dev and next build; now gitignored, re-runs below
20260930-181812 | phase6a-after-provider-switch | doctor=0 | upgrade-dry-run=0
20260930-181818 | phase6b-after-audit-sink | doctor=0 | upgrade-dry-run=0
20260930-182811 | phase6c-final | doctor=0 | upgrade-dry-run=0
20261001-082921 | dirty-tree-test | doctor=0 | upgrade-dry-run=0 | tree=dirty(2) | head=3b36cbe
NOTE | 20261001-082921 dirty-tree-test | deliberate test of the new no-skip behaviour: dry-run ran (0) on an uncommitted tree, then the checkpoint failed as designed. Rows from here on carry tree= and head=
20261001-082944 | phase6d-no-skip | doctor=0 | upgrade-dry-run=0 | tree=clean | head=8fb83a3
20261001-084600 | osv-guard-test | doctor=4 | upgrade-dry-run=0 | tree=dirty(2) | head=a219a57
NOTE | 20261001-084600 osv-guard-test | deliberate test: osv-scanner hidden, doctor exited 0 but the checkpoint now fails (doctor=4). Also: 082921 and 082944 skipped the CVE scan (shell lost PATH); superseded by the clean run below
20261001-084929 | rerun-phases1-6 | doctor=0 | upgrade-dry-run=0 | tree=clean | head=ed3c3b6
20261001-101220 | f3-fix | doctor=0 | upgrade-dry-run=0 | tree=clean | head=825ed3c
20261001-103631 | f4-f5-fix | doctor=0 | upgrade-dry-run=0 | tree=clean | head=a938a7a
20261001-105741 | security-guide | doctor=0 | upgrade-dry-run=0 | tree=clean | head=aa77baf
20261001-111724 | design-system | doctor=0 | upgrade-dry-run=0 | tree=clean | head=cc75f65
20261001-114013 | format-upstream | doctor=0 | upgrade-dry-run=0 | tree=clean | head=d501242
