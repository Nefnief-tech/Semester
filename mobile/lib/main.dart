import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'pages/onboarding_page.dart';
import 'pages/shell.dart';
import 'services/links.dart';
import 'services/push.dart';
import 'stores/registry.dart';
import 'theme/app_theme.dart';

/// flag written after the first-run onboarding is finished (or skipped) —
/// device-local, so every new install sees onboarding exactly once
const _kOnboardingDoneKey = 'semester.onboarding.done';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // hydrate all stores from SharedPreferences (zustand-persist equivalent)
  final prefs = await SharedPreferences.getInstance();
  await Stores.I.loadAll(prefs);

  // push: Firebase init is optional — without google-services.json every call
  // is guarded and the app simply runs local-only
  try {
    FirebaseMessaging.onBackgroundMessage(semesterFirebaseMessagingHandler);
  } catch (_) {}
  runApp(SemesterApp(
    showOnboarding: !(prefs.getBool(_kOnboardingDoneKey) ?? false),
  ));
  unawaitedStartup();
}

Future<void> unawaitedStartup() async {
  await PushService.init();
  await SemesterLinks.init();
}

class SemesterApp extends StatefulWidget {
  const SemesterApp({super.key, required this.showOnboarding});

  final bool showOnboarding;

  @override
  State<SemesterApp> createState() => _SemesterAppState();
}

class _SemesterAppState extends State<SemesterApp> {
  late bool _onboarding = widget.showOnboarding;

  Future<void> _finishOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kOnboardingDoneKey, true);
    if (!mounted) return;
    setState(() => _onboarding = false);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Stores.I.theme,
      builder: (context, _) {
        final dark = Stores.I.theme.dark;
        return MaterialApp(
          title: 'Semester',
          debugShowCheckedModeBanner: false,
          theme: buildSemesterTheme(dark: false),
          darkTheme: buildSemesterTheme(dark: true),
          themeMode: dark == null
              ? ThemeMode.system
              : (dark ? ThemeMode.dark : ThemeMode.light),
          home: _onboarding
              ? OnboardingPage(onDone: _finishOnboarding)
              : const AppShell(),
        );
      },
    );
  }
}
