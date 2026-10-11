import 'package:flutter/material.dart';

/// Shared motion for the app — one place so durations and curves stay
/// coherent: fast, understated, ease-out. Tab switches ride on the PageView
/// swipe itself; this covers press feedback and anything else animated.

const Duration kMotionFast = Duration(milliseconds: 150);
const Duration kMotionBase = Duration(milliseconds: 240);
const Curve kMotionCurve = Curves.easeOutCubic;

/// page transition for pushed pages (More-tab destinations): content fades
/// in while sliding up a couple of pixels — pairs with the system back
/// gesture, which pops these routes naturally
class FadeThroughRoute<T> extends PageRouteBuilder<T> {
  FadeThroughRoute({required Widget page})
      : super(
          transitionDuration: kMotionBase,
          reverseTransitionDuration: kMotionFast,
          pageBuilder: (_, _, _) => page,
          transitionsBuilder: (_, animation, _, child) {
            final t = CurvedAnimation(parent: animation, curve: kMotionCurve);
            return FadeTransition(
              opacity: t,
              child: SlideTransition(
                position: Tween(
                  begin: const Offset(0, 0.02),
                  end: Offset.zero,
                ).animate(t),
                child: child,
              ),
            );
          },
        );
}

/// subtle press feedback: scales to 0.98 while pressed, springs back on
/// release — wrap any tappable card or tile
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const Pressable({super.key, required this.child, this.onTap});

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.98 : 1,
        duration: kMotionFast,
        curve: kMotionCurve,
        child: widget.child,
      ),
    );
  }
}

/// one-shot entrance for sections and rows: fades in while sliding up,
/// delayed by the item's index so a column reveals top-down. Plays once —
/// rebuilds never re-trigger it — and collapses to instant under the
/// system's reduce-motion setting.
class StaggerIn extends StatefulWidget {
  final int index;
  final Widget child;
  const StaggerIn({super.key, required this.index, required this.child});

  @override
  State<StaggerIn> createState() => _StaggerInState();
}

class _StaggerInState extends State<StaggerIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: kMotionBase,
  );
  bool _armed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // the reduce-motion lookup belongs here, not initState — inherited
    // dependencies may only be registered from didChangeDependencies on
    if (_armed) return;
    _armed = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else {
      final delay = Duration(milliseconds: widget.index.clamp(0, 8) * 40);
      Future.delayed(delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _controller, curve: kMotionCurve);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.02), end: Offset.zero)
            .animate(curved),
        child: widget.child,
      ),
    );
  }
}
