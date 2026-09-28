import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../widgets/controls.dart';
import '../widgets/motion.dart';

/// First-run onboarding — shown exactly once per install (a plain
/// SharedPreferences flag, device-local). Three calm slides: what Semester
/// is, the timetable, and account/sync. Skippable at any point.

class OnboardingPage extends StatefulWidget {
  final Future<void> Function() onDone;
  const OnboardingPage({super.key, required this.onDone});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final PageController _page = PageController();
  int _index = 0;

  static const List<(IconData, String, String)> _slides = [
    (
      Icons.auto_awesome_outlined,
      'Welcome to Semester.',
      'Your study desk: tasks, homework, timetable, grades and the school portal — one calm place instead of five apps.',
    ),
    (
      Icons.table_chart_outlined,
      'Plan your week.',
      'Paste your timetable as JSON once — Semester builds the grid, marks substitutions and tells you what\'s now and up next.',
    ),
    (
      Icons.cloud_sync_outlined,
      'Yours everywhere.',
      'Create an account to back everything up and continue on any device. Until then, your data lives safely on this one.',
    ),
  ];

  void _next() {
    if (_index < _slides.length - 1) {
      _page.nextPage(duration: kMotionBase, curve: kMotionCurve);
    } else {
      widget.onDone();
    }
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sem = context.sem;
    final isLast = _index == _slides.length - 1;

    return Scaffold(
      backgroundColor: sem.paper,
      body: SafeArea(
        child: PlannerGrid(
          child: Column(
            children: [
              // skip
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => widget.onDone(),
                  child: Text(
                    'Skip',
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall!
                        .copyWith(color: sem.inkSoft),
                  ),
                ),
              ),
              // slides
              Expanded(
                child: PageView.builder(
                  controller: _page,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemCount: _slides.length,
                  itemBuilder: (context, i) {
                    final (icon, title, body) = _slides[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 84,
                            height: 84,
                            decoration: BoxDecoration(
                              color: sem.accentSoft,
                              borderRadius: BorderRadius.circular(22),
                            ),
                            child: Icon(icon, size: 38, color: sem.accent),
                          ),
                          const SizedBox(height: 28),
                          Text(
                            title,
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .displayMedium!
                                .copyWith(fontSize: 30),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            body,
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .bodyLarge!
                                .copyWith(
                                    color: sem.inkSoft, height: 1.55),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              // dots
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < _slides.length; i++)
                      AnimatedContainer(
                        duration: kMotionBase,
                        curve: kMotionCurve,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: i == _index ? 22 : 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: i == _index ? sem.accent : sem.line,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                  ],
                ),
              ),
              // next / get started
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: SizedBox(
                  width: double.infinity,
                  child: SemPrimaryButton(
                    onPressed: _next,
                    child: Text(
                      isLast ? 'Get started' : 'Next',
                      style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                          color: sem.paper, fontWeight: FontWeight.w500),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
