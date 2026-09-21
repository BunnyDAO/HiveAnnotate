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

  NSDictionary *found = nil;
  for (NSDictionary *info in (__bridge NSArray *)windows) {
    NSNumber *ownerPid = info[(id)kCGWindowOwnerPID];
    NSNumber *layer = info[(id)kCGWindowLayer];
    if (ownerPid.intValue != targetPid) continue;
    // Layer 0 is an ordinary document window. Menu-bar items, panels, popovers
    // and our own overlay all live above it, and capturing one of those instead
    // of the user's window would be silently wrong.
    if (layer.intValue != 0) continue;

    NSNumber *w = info[(id)kCGWindowBounds][@"Width"];
    NSNumber *h = info[(id)kCGWindowBounds][@"Height"];
    if (w.doubleValue < 1 || h.doubleValue < 1) continue;

    found = info;
    break;  // The list is front-to-back, so the first match is the frontmost.
  }

  if (!found) {
    CFRelease(windows);
    emit(@{@"ok": @NO, @"reason": @"no-window"});
    return 0;
  }

  NSDictionary *bounds = found[(id)kCGWindowBounds];
  emit(@{
    @"ok": @YES,
    @"windowId": found[(id)kCGWindowNumber],
    @"pid": @(targetPid),
    @"app": front.localizedName ?: @"",
    @"x": bounds[@"X"],
    @"y": bounds[@"Y"],
    @"width": bounds[@"Width"],
    @"height": bounds[@"Height"],
  });

  CFRelease(windows);
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

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 2) {
      emit(@{@"ok": @NO, @"reason": @"usage: hive-helper frontmost|screen-permission"});
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

    emit(@{@"ok": @NO, @"reason": @"unknown-command"});
    return 2;
  }
}
