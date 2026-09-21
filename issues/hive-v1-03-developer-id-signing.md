---
id: hive-v1-03
title: Developer ID signing + notarization wired into the dev loop
type: HITL
status: open
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

**This is a day-one dependency, not a release task.** TCC keys the Screen Recording grant to
the code-signing identity. Unsigned dev builds pin the grant to a per-build cdhash, so the
permission is invalidated on *every rebuild* — a well-documented Electron pain point that
turns the entire development loop into a permissions treadmill.

Set up a stable Developer ID identity, a fixed bundle ID and team ID, and make every local
build sign with it. Add notarization to the release build.

HITL because it needs an Apple Developer account and human credential handling.

## Acceptance criteria

- [ ] Local dev builds are signed with a stable Developer ID and a fixed bundle identifier.
- [ ] Granting Screen Recording once survives at least three consecutive rebuilds without re-prompting. **(mandatory)**
- [ ] The release build is notarized and passes `spctl --assess` / Gatekeeper on a clean machine.
- [x] Signing configuration is committed; secrets are not. The identity and Apple credentials come only from the environment.
- [x] The entitlements set is documented, including why the app is not sandboxed — `packages/app/build/entitlements.mac.plist` and `docs/signing.md`.

## Status — ready for the human half

Everything that does not need a certificate is done. **No signing identity exists in this
keychain yet**, so the remaining criteria need one action from the user.

**The finding that reframes this issue:** macOS keys the Screen Recording grant to the signing
*certificate*, not to Apple. A free, locally-created certificate keeps the grant stable across
rebuilds exactly as a Developer ID does. The $99 Developer ID is only needed to run on *other
people's* Macs (Gatekeeper and notarization). For a personal tool the free path fixes the
entire day-one problem.

To finish:

```bash
./scripts/create-dev-signing-cert.sh          # asks for your password once
HIVE_SIGNING_IDENTITY="HiveAnnotate Local Signing" npm run pack
```

Then grant Screen Recording once and confirm it survives three rebuilds.

### Found while doing this: a bug that only exists in the packaged app

The native helper was packed **inside `app.asar`**, and macOS will not execute a binary from
inside an archive. Development has no asar, so it worked perfectly there — while in the built
`.app` every window lookup, permission check and Secure Input probe would have failed.

Fixed with `asarUnpack` plus a path rewrite to the `.unpacked` twin, and **proven by running
`--self-test` inside the packaged `.app`: 20/20**, including the Secure Input probe, which only
succeeds if the helper runs from its unpacked location.

Also configured: hardened runtime (required for notarization) with the two entitlements V8
needs, and notarization that runs only when Apple credentials are present in the environment.

## Blocked by

- hive-v1-01
