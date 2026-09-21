// hive-helper — the small native surface HiveAnnotate needs and Node cannot reach.
//
//   hive-helper frontmost [--exclude-pid N]
//     Prints JSON for the frontmost ordinary window of the frontmost app:
//       {"ok":true,"windowId":123,"pid":456,"app":"Safari","x":0,"y":25,"width":1512,"height":957}
//     or {"ok":false,"reason":"no-window"} when that app has no ordinary window.
//
// Deliberately does NOT read window titles: kCGWindowName is gated behind the
// Screen Recording grant, while the window id and bounds are not. Targeting a
// window therefore works before the user has granted anything.
//
// Bounds are in Quartz global display coordinates, origin top-left of the main
// display — the same space `screencapture -R x,y,w,h` expects.

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Carbon/Carbon.h>

static void emit(NSDictionary *payload) {
  NSData *json = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
  fwrite(json.bytes, 1, json.length, stdout);
  fputc('\n', stdout);
}

static int frontmost(pid_t excludePid) {
  NSRunningApplication *front = [[NSWorkspace sharedWorkspace] frontmostApplication];
  if (!front) {
    emit(@{@"ok": @NO, @"reason": @"no-frontmost-app"});
    return 0;
  }

  pid_t targetPid = front.processIdentifier;
  if (excludePid > 0 && targetPid == excludePid) {
    emit(@{@"ok": @NO, @"reason": @"frontmost-is-self"});
    return 0;
  }

  CFArrayRef windows = CGWindowListCopyWindowInfo(
      kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
  if (!windows) {
    emit(@{@"ok": @NO, @"reason": @"window-list-unavailable"});
    return 0;
  }

  // Report every ordinary window of the frontmost app, front-to-back, and let
  // the caller choose. Which one the user means is policy, not enumeration,
  // and policy belongs where it can be tested.
  NSMutableArray *candidates = [NSMutableArray array];
  for (NSDictionary *info in (__bridge NSArray *)windows) {
    NSNumber *ownerPid = info[(id)kCGWindowOwnerPID];
    if (ownerPid.intValue != targetPid) continue;
    // Layer 0 is an ordinary document window; menu-bar items, panels, popovers
    // and our own overlay all sit above it.
    if (((NSNumber *)info[(id)kCGWindowLayer]).intValue != 0) continue;

    NSDictionary *bounds = info[(id)kCGWindowBounds];
    [candidates addObject:@{
      @"windowId": info[(id)kCGWindowNumber],
      @"x": bounds[@"X"],
      @"y": bounds[@"Y"],
      @"width": bounds[@"Width"],
      @"height": bounds[@"Height"],
    }];
  }
  CFRelease(windows);

  emit(@{
    @"ok": @YES,
    @"pid": @(targetPid),
    @"app": front.localizedName ?: @"",
    @"windows": candidates,
  });
  return 0;
}

// Reports the Screen Recording (TCC) grant without prompting for it.
// CGPreflightScreenCaptureAccess is the non-prompting query; the Request
// variant is what triggers the system dialog.
static int screenPermission(BOOL request) {
  BOOL granted = CGPreflightScreenCaptureAccess();
  if (!granted && request) granted = CGRequestScreenCaptureAccess();
  emit(@{@"ok": @YES, @"granted": granted ? @YES : @NO});
  return 0;
}

// Secure Input: while a password field is focused (or 1Password and friends
// are active), macOS withholds key events from every other app system-wide.
// There is no app-side workaround — the hotkey simply never arrives — so the
// only honest response is to tell the user why nothing happened.
static int secureInput(void) {
  emit(@{@"ok": @YES, @"secureInput": IsSecureEventInputEnabled() ? @YES : @NO});
  return 0;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 2) {
      emit(@{@"ok": @NO, @"reason": @"usage: hive-helper frontmost|screen-permission|secure-input"});
      return 2;
    }

    if (strcmp(argv[1], "frontmost") == 0) {
      pid_t exclude = 0;
      for (int i = 2; i < argc - 1; i++) {
        if (strcmp(argv[i], "--exclude-pid") == 0) exclude = (pid_t)atoi(argv[i + 1]);
      }
      return frontmost(exclude);
    }

    if (strcmp(argv[1], "screen-permission") == 0) {
      BOOL request = NO;
      for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "--request") == 0) request = YES;
      }
      return screenPermission(request);
    }

    if (strcmp(argv[1], "secure-input") == 0) return secureInput();

    emit(@{@"ok": @NO, @"reason": @"unknown-command"});
    return 2;
  }
}
