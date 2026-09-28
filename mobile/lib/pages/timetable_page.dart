import 'dart:async';

import 'package:flutter/material.dart';

import '../appwrite/sync.dart';
import '../models/types.dart';
import '../stores/registry.dart';
import '../services/api.dart';
import '../theme/app_theme.dart';
import '../utils/timetable_io.dart';
import '../utils/utils.dart';
import '../widgets/bits.dart';
import '../widgets/controls.dart';

/// Port of timetable/page.tsx — weekly grid + Eltern-portal substitute plan.

const _portalWeekday = {
  'mo': 'Mon',
  'di': 'Tue',
  'mi': 'Wed',
  'do': 'Thu',
  'fr': 'Fri',
  'sa': 'Sat',
  'so': 'Sun',
};

/// periods a plan row covers: "3" → [3], "3 - 4" → [3, 4] (double lessons)
List<int> _subPeriods(String period) {
  final range = RegExp(r'(\d+)\s*[-–/]\s*(\d+)').firstMatch(period);
  if (range != null) {
    final a = int.tryParse(range.group(1)!);
    final b = int.tryParse(range.group(2)!);
    if (a != null && b != null && b >= a) {
      return [for (var i = a; i <= b && i - a < 12; i++) i];
    }
  }
  final p = int.tryParse(period);
  return p == null ? const [] : [p];
}

String _subjectColor(String name, Map<String, String> colorsByName) =>
    colorsByName[name.toLowerCase()] ?? PALETTE[name.length % PALETTE.length];

/* ---------------- now / up next ---------------- */

/// one timetable entry with a parsed time range (minutes since midnight)
class _Slot {
  final TimetableEntry entry;
  final int startMin;
  final int endMin;
  const _Slot(this.entry, this.startMin, this.endMin);
}

/// parses "08:00 - 08:45" / "8:00–8:45" / "08.00" — a missing end time
/// defaults to a 45-minute lesson; returns null when unparseable/nonsense
_Slot? _parseSlot(TimetableEntry e) {
  final m = RegExp(
    r'(\d{1,2})\s*[:.]\s*(\d{2})\s*(?:[-–—]\s*(\d{1,2})\s*[:.]\s*(\d{2}))?',
  ).firstMatch(e.time ?? '');
  if (m == null) return null;
  final sh = int.tryParse(m.group(1)!);
  final sm = int.tryParse(m.group(2)!);
  if (sh == null || sm == null || sh > 23 || sm > 59) return null;
  final eh = m.group(3) == null ? null : int.tryParse(m.group(3)!);
  final em = m.group(4) == null ? null : int.tryParse(m.group(4)!);
  int endMin;
  if (eh != null && em != null && eh <= 24 && em <= 59) {
    endMin = eh * 60 + em;
  } else {
    endMin = sh * 60 + sm + 45;
  }
  final startMin = sh * 60 + sm;
  if (endMin > 24 * 60) endMin = 24 * 60;
  if (endMin <= startMin) return null;
  return _Slot(e, startMin, endMin);
}

String _hhmm(int minutes) =>
    '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';

class TimetablePage extends StatefulWidget {
  const TimetablePage({super.key});

  @override
  State<TimetablePage> createState() => _TimetablePageState();
}

class _TimetablePageState extends State<TimetablePage> {
  /// ticks every 30 s so the now/up-next card and the current-lesson
  /// highlight follow the clock without a manual refresh
  Timer? _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    // auto-fetch on first build when enabled and credentials are stored
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = Stores.I.portal;
      if (p.autoFetch &&
          p.baseUrl.isNotEmpty &&
          p.username.isNotEmpty &&
          p.password.isNotEmpty) {
        _fetchNow();
      }
    });
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _fetchNow() async {
    final portal = Stores.I.portal;
    if (portal.error == null &&
        portal.data != null &&
        portal.lastFetched != null)
      return;
    await doPortalFetch(context);
  }

  @override
  Widget build(BuildContext context) {
    final stores = Stores.I;
    return ListenableBuilder(
      listenable: Listenable.merge([
        stores.timetable,
        stores.portal,
        stores.subjects,
        stores.auth,
      ]),
      builder: (context, _) {
        final sem = context.sem;
        final entries = stores.timetable.entries;
        final portal = stores.portal;
        final subjects = stores.subjects.subjects;

        final colorsByName = <String, String>{
          for (final s in subjects) s.name.toLowerCase(): s.color,
        };

        final days = [
          for (final d in DAY_ORDER)
            if (entries.any((e) => e.day == d)) d,
        ];
        final periods = {...entries.map((e) => e.period)}.toList()..sort();
        final periodTime = <int, String>{};
        for (final e in entries) {
          if (e.time != null && !periodTime.containsKey(e.period)) {
            periodTime[e.period] = e.time!;
          }
        }
        final now = _now;
        final todayCol = DAY_ORDER[now.weekday == 7 ? 6 : now.weekday - 1];

        // ---- time awareness: current + next lesson today ----
        final nowMinutes = now.hour * 60 + now.minute + now.second / 60.0;
        final todaySlots = entries
            .where((e) => e.day == todayCol)
            .map(_parseSlot)
            .whereType<_Slot>()
            .toList()
          ..sort((a, b) => a.startMin.compareTo(b.startMin));
        _Slot? currentLesson;
        _Slot? upNextLesson;
        for (final s in todaySlots) {
          if (nowMinutes >= s.startMin && nowMinutes <= s.endMin) {
            currentLesson ??= s;
          }
          if (nowMinutes < s.startMin) upNextLesson ??= s;
        }
        final double? currentProgress = currentLesson == null
            ? null
            : ((nowMinutes - currentLesson.startMin) /
                    (currentLesson.endMin - currentLesson.startMin))
                .clamp(0.0, 1.0)
                .toDouble();

        // substitute-plan entries that affect the grid — the student's own
        // courses when the membership list was scraped, otherwise all rows
        final relevantSubs = portal.data == null
            ? <PortalSub>[]
            : () {
                final all = portal.data!.allEntries;
                final own = portal.data!.courses
                    .map((c) => c.trim())
                    .where((c) => c.isNotEmpty)
                    .toList();
                return own.isEmpty
                    ? all
                    : all
                        .where((s) => own.contains(s.course.trim()))
                        .toList();
              }();

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PageHeader(
                title: 'Timetable',
                subtitle:
                    'paste your timetable as JSON — formatted automatically',
                trailing: entries.isNotEmpty
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SemGhostButton(
                            onPressed: () => _openJsonSheet(context, entries),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.upload_outlined, size: 15),
                                SizedBox(width: 6),
                                Text('Edit JSON'),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          SemGhostButton(
                            onPressed: () async {
                              final ok = await confirmDialog(
                                context,
                                'Clear the whole timetable?',
                                title: 'Clear timetable',
                              );
                              if (ok) Stores.I.timetable.clear();
                            },
                            foreground: sem.marker,
                            border: sem.marker.withValues(alpha: 0.4),
                            child: const Icon(
                              Icons.layers_clear_outlined,
                              size: 16,
                            ),
                          ),
                        ],
                      )
                    : null,
              ),

              // NOW / up next — time-aware glance card
              if (entries.isNotEmpty)
                _buildNowCard(
                  context,
                  sem,
                  slots: todaySlots,
                  current: currentLesson,
                  upNext: upNextLesson,
                  nowMinutes: nowMinutes,
                ),

              // portal settings + status
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: PortalCard(relevantCount: relevantSubs.length),
                ),
              ),

              const SizedBox(height: 20),

              // legend
              if (relevantSubs.isNotEmpty || portal.error != null) ...[
                Wrap(
                  spacing: 14,
                  runSpacing: 4,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: sem.marker,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          'cancelled',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: sem.amber,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          'substituted',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                    if (relevantSubs.isNotEmpty)
                      Text(
                        '· ${relevantSubs.length} for your courses',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                  ],
                ),
                const SizedBox(height: 10),
              ],

              // grid
              if (entries.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    decoration: BoxDecoration(
                      color: sem.card,
                      border: Border.all(color: sem.line),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: LayoutBuilder(
                      builder: (context, gridConstraints) {
                        // stretch columns to the pane width (iPad); scroll
                        // only when the minimum width doesn't fit (phone)
                        final minWidth = 76.0 + days.length * 92.0;
                        final available = gridConstraints.maxWidth - 2;
                        final gridWidth =
                            available > minWidth ? available : minWidth;
                        return SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: SizedBox(
                            width: gridWidth,
                        child: Column(
                          children: [
                            // header row
                            Row(
                              children: [
                                _cellHead(
                                  context,
                                  width: 76,
                                  child: Text(
                                    'PD',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall!
                                        .copyWith(letterSpacing: 1.2),
                                  ),
                                ),
                                for (final d in days)
                                  _cellHead(
                                    context,
                                    flex: true,
                                    highlight: d == todayCol,
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          d,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium!
                                              .copyWith(
                                                fontWeight: FontWeight.w600,
                                                color: d == todayCol
                                                    ? sem.accent
                                                    : sem.ink,
                                              ),
                                        ),
                                        if (d == todayCol) ...[
                                          const SizedBox(width: 6),
                                          Text(
                                            'TODAY',
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelSmall!
                                                .copyWith(
                                                  fontSize: 8,
                                                  letterSpacing: 1,
                                                ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                            // body rows — IntrinsicHeight gives the stretch
                            // Row a bounded height (a stretch Row inside the
                            // scroll views would otherwise force infinite
                            // child heights and break the whole layout)
                            for (final p in periods)
                              IntrinsicHeight(
                                child: Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    _cellHead(
                                      context,
                                      width: 76,
                                      box: true,
                                      child: Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            '$p',
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelLarge!
                                                .copyWith(
                                                  color: sem.ink,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                          ),
                                          if (periodTime[p] != null)
                                            Text(
                                              periodTime[p]!.split(' - ').first,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .labelSmall!
                                                  .copyWith(fontSize: 8),
                                            ),
                                        ],
                                      ),
                                    ),
                                    for (final d in days)
                                      _cell(
                                        context,
                                        flex: true,
                                        highlight: d == todayCol,
                                        isNow:
                                            currentLesson != null &&
                                            d == todayCol &&
                                            p == currentLesson.entry.period,
                                        cancelled: _cellCancelled(
                                          relevantSubs,
                                          d,
                                          p,
                                        ),
                                        substituted: _cellSubstituted(
                                          relevantSubs,
                                          d,
                                          p,
                                        ),
                                        child: _cellContent(
                                          context,
                                          d,
                                          p,
                                          entries,
                                          relevantSubs,
                                          colorsByName,
                                          progress: currentLesson != null &&
                                                  d == todayCol &&
                                                  p == currentLesson.entry.period
                                              ? currentProgress
                                              : null,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                      },
                  ),
                ),
              )
              else
                EmptyState(
                  icon: Icons.table_chart_outlined,
                  title: 'No timetable yet',
                  hint:
                      "Paste your school's timetable as JSON and it becomes a clean weekly grid. The example shows the exact format.",
                  action: SemPrimaryButton(
                    onPressed: () => _openJsonSheet(context, entries),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.upload_outlined, size: 16),
                        SizedBox(width: 6),
                        Text('Paste JSON'),
                      ],
                    ),
                  ),
                ),

              // substitutions list
              if (relevantSubs.isNotEmpty) ...[
                const SizedBox(height: 32),
                Text(
                  'Substitutions',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                for (final day in portal.data?.days ?? const <PortalDay>[]) ...[
                  () {
                    final daySubs = relevantSubs
                        .where((s) => s.date == day.date)
                        .toList();
                    if (daySubs.isEmpty) return const SizedBox.shrink();
                    return Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: sem.card,
                        border: Border.all(color: sem.line),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${day.weekday}., ${day.date}',
                            style: Theme.of(
                              context,
                            ).textTheme.labelSmall!.copyWith(fontSize: 11),
                          ),
                          const SizedBox(height: 8),
                          for (final s in daySubs)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(
                                children: [
                                  SemChip(
                                    mono: true,
                                    tone: s.cancelled ? Tone.bad : Tone.warn,
                                    text: '${s.period}.',
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Wrap(
                                      crossAxisAlignment:
                                          WrapCrossAlignment.center,
                                      spacing: 6,
                                      children: [
                                        if (s.courseOld != null)
                                          Text(
                                            s.courseOld!,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodyMedium!
                                                .copyWith(
                                                  color: sem.inkSoft,
                                                  decoration: TextDecoration
                                                      .lineThrough,
                                                ),
                                          ),
                                        Text(
                                          s.course,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium!
                                              .copyWith(
                                                fontWeight: FontWeight.w500,
                                              ),
                                        ),
                                        if (!s.cancelled &&
                                            s.substitute.isNotEmpty)
                                          Text(
                                            '→ ${s.substitute}',
                                            style: TextStyle(
                                              color: sem.inkSoft,
                                            ),
                                          ),
                                        if (s.room.isNotEmpty)
                                          Text(
                                            'room ${s.room}',
                                            style: Theme.of(
                                              context,
                                            ).textTheme.labelSmall,
                                          ),
                                        if (s.info.isNotEmpty)
                                          Text(
                                            s.info,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall!
                                                .copyWith(
                                                  fontSize: 11,
                                                  color: sem.inkSoft,
                                                ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    );
                  }(),
                ],
              ],
            ],
          ),
        );
      },
    );
  }

  /* ---------------- now / up next card ---------------- */

  Widget _buildNowCard(
    BuildContext context,
    SemColors sem, {
    required List<_Slot> slots,
    required _Slot? current,
    required _Slot? upNext,
    required double nowMinutes,
  }) {
    if (slots.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);

    final Widget header;
    final Widget body;
    if (current != null) {
      final e = current.entry;
      final left = (current.endMin - nowMinutes).round();
      header = const SemLabel('now');
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  e.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge,
                ),
              ),
              const SizedBox(width: 10),
              SemChip(mono: true, text: e.time ?? _hhmm(current.startMin)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Container(
              height: 6,
              color: sem.paperDeep,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: ((nowMinutes - current.startMin) /
                        (current.endMin - current.startMin))
                    .clamp(0.0, 1.0),
                child: Container(color: sem.accent),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${left <= 0 ? 'ending now' : '$left min left'}'
            '${(e.room?.isNotEmpty ?? false) ? ' · room ${e.room}' : ''}'
            '${(e.teacher?.isNotEmpty ?? false) ? ' · ${e.teacher}' : ''}',
            style: theme.textTheme.labelSmall,
          ),
        ],
      );
    } else if (upNext != null) {
      final e = upNext.entry;
      final mins = (upNext.startMin - nowMinutes).round();
      header = const SemLabel('up next');
      body = Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge,
                ),
                if (e.room?.isNotEmpty ?? false)
                  Text('room ${e.room}',
                      style: theme.textTheme.labelSmall),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(_hhmm(upNext.startMin),
                  style: theme.textTheme.labelLarge),
              const SizedBox(height: 2),
              Text(
                mins <= 0 ? 'starting now' : 'in $mins min',
                style: theme.textTheme.labelSmall!
                    .copyWith(color: sem.accent),
              ),
            ],
          ),
        ],
      );
    } else {
      header = const SemLabel('today');
      body = Text(
        "School's out — no more lessons today.",
        style: theme.textTheme.bodyMedium!
            .copyWith(color: sem.inkSoft, fontStyle: FontStyle.italic),
      );
    }

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: SemCard(
            borderColor:
                current != null ? sem.accent.withValues(alpha: 0.5) : null,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                header,
                const SizedBox(height: 8),
                body,
              ],
            ),
          ),
        ),
      ),
    );
  }

  /* ---------------- cell helpers ---------------- */

  Widget _cellHead(
    BuildContext context, {
    required Widget child,
    double? width,
    bool flex = false,
    bool box = false,
    bool highlight = false,
  }) {
    final sem = context.sem;
    final Widget cell = Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      decoration: BoxDecoration(
        color: highlight ? sem.accentSoft : sem.card,
        border: Border(
          bottom: BorderSide(color: sem.line),
          right: BorderSide(color: sem.line),
        ),
      ),
      alignment: Alignment.center,
      child: child,
    );
    return flex ? Expanded(child: cell) : cell;
  }

  Widget _cell(
    BuildContext context, {
    required Widget child,
    bool flex = false,
    bool highlight = false,
    bool cancelled = false,
    bool substituted = false,
    bool isNow = false,
  }) {
    final sem = context.sem;
    final Widget cell = Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: cancelled
            ? sem.marker.withValues(alpha: 0.08)
            : substituted
            ? sem.amber.withValues(alpha: 0.07)
            : isNow
            ? sem.accent.withValues(alpha: 0.15)
            : highlight
            ? sem.accent.withValues(alpha: 0.06)
            : null,
        border: Border(
          bottom: BorderSide(color: sem.line),
          right: BorderSide(color: sem.line),
        ),
      ),
      alignment: Alignment.topLeft,
      child: child,
    );
    return flex ? Expanded(child: cell) : cell;
  }

  /// plan rows landing in one timetable cell: same weekday + overlapping
  /// period. The course code is not re-checked against the lesson — the
  /// timetable JSON may spell subjects differently ("Mathe" vs "2ph1"), and
  /// the membership filter already picked the student's own courses.
  List<PortalSub> _cellSubsFor(
    List<PortalSub> subs,
    String day,
    int period,
  ) {
    return subs.where((s) {
      if (_portalWeekday[s.weekday.toLowerCase()] != day) return false;
      return _subPeriods(s.period).contains(period);
    }).toList();
  }

  bool _cellCancelled(
    List<PortalSub> subs,
    String day,
    int period,
  ) => _cellSubsFor(subs, day, period).any((s) => s.cancelled);

  bool _cellSubstituted(
    List<PortalSub> subs,
    String day,
    int period,
  ) => _cellSubsFor(subs, day, period).any((s) => !s.cancelled);

  Widget _cellContent(
    BuildContext context,
    String day,
    int period,
    List<TimetableEntry> entries,
    List<PortalSub> relevantSubs,
    Map<String, String> colorsByName, {
    double? progress,
  }) {
    final sem = context.sem;
    final items = entries
        .where((e) => e.day == day && e.period == period)
        .toList();
    final cellSubs = _cellSubsFor(relevantSubs, day, period);

    if (items.isEmpty && cellSubs.isEmpty) {
      return Text(
        '—',
        style: TextStyle(color: sem.inkSoft.withValues(alpha: 0.4)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final e in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    SubjectDot(_subjectColor(e.subject, colorsByName), size: 9),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        e.subject,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall!.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (e.time != null)
                  Text(
                    e.time!,
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall!.copyWith(fontSize: 8),
                  ),
                if (e.teacher != null)
                  Text(
                    e.teacher!,
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall!.copyWith(fontSize: 8),
                  ),
                if (e.room != null)
                  Text(
                    'room ${e.room}',
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall!.copyWith(fontSize: 8),
                  ),
              ],
            ),
          ),
        for (final s in cellSubs)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Text(
              s.cancelled
                  ? 'cancelled · ${s.date.substring(0, 6)}'
                  : '→ ${s.substitute.isEmpty ? '?' : s.substitute}${s.room.isEmpty ? '' : ' · ${s.room}'} · ${s.date.substring(0, 6)}',
              style: Theme.of(context).textTheme.labelSmall!.copyWith(
                fontSize: 8.5,
                color: toneColor(context, s.cancelled ? Tone.bad : Tone.warn),
              ),
            ),
          ),
        if (progress != null) ...[
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Container(
              height: 4,
              color: sem.paperDeep,
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: progress.clamp(0.0, 1.0),
                child: Container(color: sem.accent),
              ),
            ),
          ),
        ],
      ],
    );
  }

  /* ---------------- json import sheet ---------------- */

  void _openJsonSheet(BuildContext context, List<TimetableEntry> entries) {
    final controller = TextEditingController(
      text: entries.isNotEmpty ? timetableToJson(entries) : '',
    );
    showSemSheet(
      context: context,
      title: entries.isEmpty ? 'Paste timetable JSON' : 'Edit timetable JSON',
      builder: (sheetContext) => _JsonImportBody(controller: controller),
    );
  }
}

Future<void> doPortalFetch(BuildContext context) async {
  final portal = Stores.I.portal;
  portal.setError(null);
  try {
    final plan = await SemesterApi.fetchPortalPlan();
    portal.setData(plan);
    // best-effort: plan (no credentials) into the cloud for the daily digest.
    // The fetch is authoritative — retract rows from older fetches / the web
    // so the cloud never keeps two versions of the same slot alive.
    await reconcilePortalSnapshot();
  } on ApiException catch (e) {
    portal.setError(e.message);
  } catch (_) {
    portal.setError('Could not reach the portal.');
  }
}

/* ---------------- portal settings card ---------------- */

class PortalCard extends StatefulWidget {
  final int relevantCount;
  const PortalCard({super.key, required this.relevantCount});

  @override
  State<PortalCard> createState() => _PortalCardState();
}

class _PortalCardState extends State<PortalCard> {
  bool _open = false;
  bool _fetching = false;
  late final _url = TextEditingController(text: Stores.I.portal.baseUrl);
  late final _username = TextEditingController(text: Stores.I.portal.username);
  late final _password = TextEditingController(text: Stores.I.portal.password);

  @override
  void initState() {
    super.initState();
    _url.addListener(() => Stores.I.portal.setSettings(baseUrl: _url.text));
    _username.addListener(
      () => Stores.I.portal.setSettings(username: _username.text),
    );
    _password.addListener(
      () => Stores.I.portal.setSettings(password: _password.text),
    );
  }

  @override
  void dispose() {
    _url.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final portal = Stores.I.portal;
    final sem = context.sem;

    return ListenableBuilder(
      listenable: portal,
      builder: (context, _) {
        final hasSettings =
            portal.baseUrl.isNotEmpty &&
            portal.username.isNotEmpty &&
            portal.password.isNotEmpty;
        final open = _open || portal.data == null || portal.error != null;
        return SemCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              InkWell(
                onTap: () => setState(() => _open = !open),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Substitute plan (Vertretungsplan)',
                              style: Theme.of(context).textTheme.titleMedium!
                                  .copyWith(fontWeight: FontWeight.w600),
                            ),
                            if (portal.lastFetched != null &&
                                portal.error == null)
                              Text(
                                'fetched ${formatClock(portal.lastFetched!)}${widget.relevantCount > 0 ? ' · ${widget.relevantCount} for your courses' : ''}',
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                          ],
                        ),
                      ),
                      Icon(
                        open ? Icons.expand_less : Icons.expand_more,
                        color: sem.inkSoft,
                      ),
                    ],
                  ),
                ),
              ),
              if (open) ...[
                Container(height: 1, color: sem.line),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SemLabel('Portal URL'),
                      TextField(
                        controller: _url,
                        decoration: const InputDecoration(
                          hintText: 'https://evbg.eltern-portal.org',
                        ),
                      ),
                      const SizedBox(height: 12),
                      const SemLabel('Portal email'),
                      TextField(
                        controller: _username,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 12),
                      const SemLabel('Portal password'),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          SizedBox(
                            height: 24,
                            width: 24,
                            child: Checkbox(
                              value: portal.autoFetch,
                              onChanged: (v) =>
                                  portal.setSettings(autoFetch: v ?? true),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'fetch automatically on every visit',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Align(
                        alignment: Alignment.centerRight,
                        child: SemPrimaryButton(
                          onPressed: !_fetching && hasSettings
                              ? () async {
                                  setState(() => _fetching = true);
                                  await doPortalFetch(context);
                                  if (mounted)
                                    setState(() => _fetching = false);
                                }
                              : null,
                          child: _fetching
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.refresh, size: 16),
                                    SizedBox(width: 6),
                                    Text('Fetch now'),
                                  ],
                                ),
                        ),
                      ),
                      if (portal.error != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          portal.error!,
                          style: TextStyle(color: sem.marker, fontSize: 13),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Text(
                        'credentials are stored only on this device and sent only to your own server when fetching.',
                        style: Theme.of(
                          context,
                        ).textTheme.labelSmall!.copyWith(height: 1.6),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/* ---------------- json import body ---------------- */

class _JsonImportBody extends StatefulWidget {
  final TextEditingController controller;
  const _JsonImportBody({required this.controller});

  @override
  State<_JsonImportBody> createState() => _JsonImportBodyState();
}

class _JsonImportBodyState extends State<_JsonImportBody> {
  String _error = '';
  List<String> _warnings = [];

  void _load(String raw) {
    try {
      final result = parseTimetable(raw);
      Stores.I.timetable.setTimetable(result.entries);
      setState(() {
        _warnings = result.warnings;
        _error = '';
      });
      if (result.warnings.isEmpty && context.mounted)
        Navigator.of(context).pop();
    } on FormatException catch (e) {
      setState(() {
        _error = e.message;
        _warnings = [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sem = context.sem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'each entry: day · period · subject — optional: time · teacher · room.',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            SemGhostButton(
              onPressed: () {
                widget.controller.text = EXAMPLE_TIMETABLE;
                setState(() => _error = '');
              },
              child: const Text('Use example', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextField(
          controller: widget.controller,
          maxLines: 10,
          style: Theme.of(context).textTheme.labelMedium!.copyWith(
            fontSize: 11,
            color: sem.ink,
            height: 1.5,
          ),
          autocorrect: false,
          decoration: const InputDecoration(
            hintText:
                '[{ "day": "mon", "period": 1, "subject": "Mathematics", "room": "B102" }, …]',
          ),
        ),
        const SizedBox(height: 10),
        if (_error.isNotEmpty)
          Text(_error, style: TextStyle(color: sem.marker, fontSize: 13)),
        for (final w in _warnings)
          Text('• $w', style: TextStyle(color: sem.amber, fontSize: 11)),
        const SizedBox(height: 14),
        Align(
          alignment: Alignment.centerRight,
          child: SemPrimaryButton(
            onPressed: () => _load(widget.controller.text),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.upload_outlined, size: 16),
                SizedBox(width: 6),
                Text('Format timetable'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
