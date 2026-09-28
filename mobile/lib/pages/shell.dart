import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../appwrite/sync.dart';
import '../navigation.dart';
import '../services/api.dart';
import '../services/push.dart';
import '../services/widgets.dart';
import '../stores/registry.dart';
import '../theme/app_theme.dart';
import '../widgets/controls.dart';
import '../widgets/motion.dart';
import 'calendar_page.dart';
import 'dashboard_page.dart';
import 'grades_page.dart';
import 'homework_page.dart';
import 'more_page.dart';
import 'settings_page.dart';
import 'study_room_page.dart';
import 'timetable_page.dart';
import 'todos_page.dart';

/// Port of AppShell.tsx for phones: five main tabs (Overview · Tasks ·
/// Homework · Timetable · More) — swipeable, bottom bar, More-destinations
/// pushed as full-screen pages.
///
/// iPad (regular width ≥ 768): the same pages render in a sidebar shell —
/// permanent destination list instead of the bottom bar, overflow pages
/// shown in the content pane (no navigator push) with a slim header, and
/// content constrained to a readable max width. The phone system is
/// untouched; the layout switches with the window (Split View ready).

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

/// one of the four overflow destinations (More-tab pages)
class _OverflowDestination {
  final String key;
  final String title;
  final Widget page;
  const _OverflowDestination(this.key, this.title, this.page);
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  static const _tabs = [
    ('Overview', Icons.dashboard_outlined, Icons.dashboard),
    ('Tasks', Icons.checklist_outlined, Icons.checklist),
    ('Homework', Icons.menu_book_outlined, Icons.menu_book),
    ('Timetable', Icons.table_chart_outlined, Icons.table_chart),
    ('More', Icons.apps_outlined, Icons.apps),
  ];

  static const _destinations = [
    _OverflowDestination('calendar', 'Calendar', CalendarPage()),
    _OverflowDestination('grades', 'Grades', GradesPage()),
    _OverflowDestination('study', 'Study Room', StudyRoomPage()),
    _OverflowDestination('settings', 'Settings', SettingsPage()),
  ];

  final PageController _swipe = PageController();
  int _currentTab = kTabOverview;
  final List<int> _tabHistory = [];

  /// iPad content-pane page (null = show tab content)
  _OverflowDestination? _panePage;

  bool _isRegular(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= 768;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    initSync();
    SemesterApi.refreshDocuments();
    PushService.init();
    // home-screen widgets follow the stores (agenda + today's timetable)
    SemesterWidgets.init();
    AppNav.I.tab.addListener(_onTabChanged);
    // Navigator lookups are illegal in initState — wire after the first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // adaptive at call time: phones push the page, iPads show it in-pane
      AppNav.I.openCalendar = () =>
          _openOverflow(_destinations[0]);
      AppNav.I.openGrades = () => _openOverflow(_destinations[1]);
      AppNav.I.openStudy = () => _openOverflow(_destinations[2]);
      AppNav.I.openSettings = () => _openOverflow(_destinations[3]);
      AppNav.I.markShellReady();
    });
  }

  @override
  void dispose() {
    AppNav.I.tab.removeListener(_onTabChanged);
    _swipe.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _openOverflow(_OverflowDestination destination) {
    if (!mounted) return;
    if (_isRegular(context)) {
      setState(() => _panePage = destination);
    } else {
      _pushPage(destination.title, destination.page);
    }
  }

  void _pushPage(String title, Widget page) {
    final line = context.sem.line;
    Navigator.of(context).push(
      FadeThroughRoute(
        page: Scaffold(
          appBar: AppBar(
            title: Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall!
                  .copyWith(fontSize: 18),
            ),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(1),
              child: Container(height: 1, color: line),
            ),
          ),
          body: PlannerGrid(child: page),
        ),
      ),
    );
  }

  /// single sync point: whatever sets AppNav.I.tab (bottom-bar tap, swipe,
  /// push payload, deeplink) ends up here — the PageView follows along and
  /// the previous tab is remembered for the system back gesture
  void _onTabChanged() {
    final next = AppNav.I.tab.value.clamp(0, _tabs.length - 1);
    if (next == _currentTab) return;
    _tabHistory.add(_currentTab);
    if (_tabHistory.length > 16) _tabHistory.removeAt(0);
    _currentTab = next;
    if (_swipe.hasClients && (_swipe.page?.round() ?? next) != next) {
      _swipe.animateToPage(
        next,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
    setState(() {});
  }

  void _goTab(int index) {
    // tab items sit underneath an open pane page — switching tabs closes it
    // (Expo parity: setTab clears the page; without this the tabs look dead
    // while Settings/Calendar/… is open)
    if (_panePage != null) setState(() => _panePage = null);
    AppNav.I.tab.value = index;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // the process is suspended in background — realtime drops and events are
    // missed; pull everything again when the user comes back
    if (state == AppLifecycleState.resumed) {
      resync();
    }
  }

  String get _currentLabel {
    if (_currentTab >= _tabs.length) return _tabs.first.$1;
    return _tabs[_currentTab].$1;
  }

  void _toggleTheme(BuildContext context) {
    final theme = Stores.I.theme;
    final current = theme.dark ?? (MediaQuery.platformBrightnessOf(context) == Brightness.dark);
    theme.setDark(!current);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // the system back gesture (edge swipe) walks back through tab history
      // instead of leaving the app; on iPad an open pane page closes first.
      // Pushed More-pages (phone) pop on their own route before this fires.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_isRegular(context) && _panePage != null) {
          setState(() => _panePage = null);
        } else if (_tabHistory.isNotEmpty) {
          final previous = _tabHistory.removeLast();
          AppNav.I.tab.value = previous;
        } else if (_currentTab != kTabOverview) {
          AppNav.I.tab.value = kTabOverview;
        } else {
          SystemNavigator.pop();
        }
      },
      child: ListenableBuilder(
        listenable: Stores.I.theme,
        builder: (context, _) {
          if (_isRegular(context)) return _buildIpad(context);
          return _buildPhone(context);
        },
      ),
    );
  }

  /* ================= phone (unchanged layout) ================= */

  Widget _buildPhone(BuildContext context) {
    final sem = context.sem;
    return Scaffold(
      backgroundColor: sem.paper,
      appBar: AppBar(
        title: GestureDetector(
          onTap: () => _goTab(kTabOverview),
          child: RichText(
            text: TextSpan(
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall!
                  .copyWith(fontSize: 20),
              children: [
                const TextSpan(text: 'Semester'),
                TextSpan(text: '.', style: TextStyle(color: sem.accent)),
              ],
            ),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                _currentLabel.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall!.copyWith(
                      letterSpacing: 1.4,
                    ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Toggle dark mode',
            icon: Icon(
              (Stores.I.theme.dark ??
                      MediaQuery.platformBrightnessOf(context) == Brightness.dark)
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined,
              size: 19,
              color: sem.inkSoft,
            ),
            onPressed: () => _toggleTheme(context),
          ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: sem.line),
        ),
      ),
      body: PlannerGrid(
        child: PageView(
          controller: _swipe,
          onPageChanged: (i) => AppNav.I.tab.value = i,
          children: const [
            _KeepAlive(DashboardPage()),
            _KeepAlive(TodosPage()),
            _KeepAlive(HomeworkPage()),
            _KeepAlive(TimetablePage()),
            _KeepAlive(MorePage()),
          ],
        ),
      ),
      bottomNavigationBar: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(18),
        ),
        child: Container(
          decoration: BoxDecoration(
            color: sem.paper.withValues(alpha: 0.97),
            border: Border(top: BorderSide(color: sem.line)),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: InkWell(
                      onTap: () => _goTab(i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              i == _currentTab ? _tabs[i].$3 : _tabs[i].$2,
                              size: 21,
                              color: i == _currentTab
                                  ? sem.accent
                                  : sem.inkSoft,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _tabs[i].$1,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall!
                                  .copyWith(
                                    fontSize: 9,
                                    letterSpacing: 0.2,
                                    fontWeight: i == _currentTab
                                        ? FontWeight.w600
                                        : FontWeight.w400,
                                    color: i == _currentTab
                                        ? sem.accent
                                        : sem.inkSoft,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /* ================= iPad (sidebar shell) ================= */

  Widget _buildIpad(BuildContext context) {
    final sem = context.sem;
    // the More hub is redundant here — its four destinations are sidebar items
    final effectiveTab = _currentTab == kTabMore ? kTabOverview : _currentTab;
    final sidebarWidth = (MediaQuery.sizeOf(context).width * 0.22)
        .clamp(240.0, 300.0);
    final page = _panePage;

    return Scaffold(
      backgroundColor: sem.paper,
      body: SafeArea(
        child: Row(
          children: [
            // ---------- sidebar ----------
            Container(
              width: sidebarWidth,
              color: sem.paperDeep,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 16, 20),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: () => _goTab(kTabOverview),
                        child: RichText(
                          text: TextSpan(
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall!
                                .copyWith(fontSize: 20),
                            children: [
                              const TextSpan(text: 'Semester'),
                              TextSpan(
                                  text: '.',
                                  style: TextStyle(color: sem.accent)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  for (var i = 0; i < _tabs.length - 1; i++)
                    _sideItem(
                      context,
                      sem,
                      icon: i == effectiveTab && page == null
                          ? _tabs[i].$3
                          : _tabs[i].$2,
                      label: _tabs[i].$1,
                      selected: page == null && effectiveTab == i,
                      onTap: () => _goTab(i),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 6),
                    child: Container(
                        height: 1, color: sem.line),
                  ),
                  for (final d in _destinations)
                    _sideItem(
                      context,
                      sem,
                      icon: _destinationIcon(d.key),
                      label: d.title,
                      selected: page?.key == d.key,
                      onTap: () => _openOverflow(d),
                    ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 16, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Semester for iPad',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall!
                                .copyWith(color: sem.inkSoft),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Toggle dark mode',
                          icon: Icon(
                            (Stores.I.theme.dark ??
                                    MediaQuery.platformBrightnessOf(context) ==
                                        Brightness.dark)
                                ? Icons.light_mode_outlined
                                : Icons.dark_mode_outlined,
                            size: 19,
                            color: sem.inkSoft,
                          ),
                          onPressed: () => _toggleTheme(context),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // ---------- divider ----------
            Container(width: 1, color: sem.line),
            // ---------- content pane ----------
            Expanded(
              child: Column(
                children: [
                  if (page != null) _paneHeader(page, sem),
                  Expanded(
                    child: PlannerGrid(
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 900),
                          child: AnimatedSwitcher(
                            duration: kMotionBase,
                            switchInCurve: kMotionCurve,
                            child: KeyedSubtree(
                              key: ValueKey(page?.key ?? 'tab-$effectiveTab'),
                              child: page != null
                                  ? page.page
                                  : IndexedStack(
                                      index: effectiveTab,
                                      children: const [
                                        DashboardPage(),
                                        TodosPage(),
                                        HomeworkPage(),
                                        TimetablePage(),
                                        MorePage(),
                                      ],
                                    ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _destinationIcon(String key) {
    switch (key) {
      case 'calendar':
        return Icons.calendar_month_outlined;
      case 'grades':
        return Icons.calculate_outlined;
      case 'study':
        return Icons.auto_awesome_outlined;
      default:
        return Icons.settings_outlined;
    }
  }

  Widget _sideItem(
    BuildContext context,
    SemColors sem, {
    required IconData icon,
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Material(
        color: selected ? sem.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Icon(icon,
                    size: 19,
                    color: selected ? sem.paper : sem.inkSoft),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                          color: selected ? sem.paper : sem.ink,
                          fontWeight:
                              selected ? FontWeight.w500 : FontWeight.w400,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _paneHeader(_OverflowDestination page, SemColors sem) {
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: sem.line)),
      ),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_left),
              onPressed: () => setState(() => _panePage = null),
            ),
            Expanded(
              child: Text(
                page.title,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall!
                    .copyWith(fontSize: 18),
              ),
            ),
            IconButton(
              tooltip: 'Toggle dark mode',
              icon: Icon(
                (Stores.I.theme.dark ??
                        MediaQuery.platformBrightnessOf(context) ==
                            Brightness.dark)
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
                size: 19,
                color: sem.inkSoft,
              ),
              onPressed: () => _toggleTheme(context),
            ),
            const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}

/// keeps a PageView page's state (scroll positions, controllers) alive once
/// it has been built — swiping far away and back must not reset a page
class _KeepAlive extends StatefulWidget {
  final Widget child;
  const _KeepAlive(this.child);

  @override
  State<_KeepAlive> createState() => _KeepAliveState();
}

class _KeepAliveState extends State<_KeepAlive>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}
