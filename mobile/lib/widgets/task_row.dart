import 'package:flutter/material.dart';

import '../models/types.dart';
import '../theme/app_theme.dart';
import 'bits.dart';
import 'controls.dart';

/// Shared row for the tasks and homework lists: one flat row inside a
/// ListSection, swipe right to complete, swipe left to delete (with an
/// undo snack bar instead of a confirm dialog — the row is recoverable,
/// so interruption beats interrogation). Overdue rows carry a thin
/// marker-colored rail on the left edge.

/// deletion with a 4-second undo window; the caller restores the exact
/// object (same id) so cloud sync stays consistent
void showUndoDelete(
  BuildContext context, {
  required String message,
  required VoidCallback onUndo,
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    content: Text(message),
    duration: const Duration(seconds: 4),
    action: SnackBarAction(label: 'Undo', onPressed: onUndo),
  ));
}

/// Dismissible wrapper: swipe right toggles done in place (the row stays —
/// confirmDismiss returns false), swipe left removes it (caller handles the
/// store + undo snack bar) and lets the row collapse.
class SwipeActionRow extends StatelessWidget {
  final String id;
  final bool done;
  final VoidCallback onToggleDone;
  final VoidCallback onDelete;
  final Widget child;

  const SwipeActionRow({
    super.key,
    required this.id,
    required this.done,
    required this.onToggleDone,
    required this.onDelete,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final sem = context.sem;
    return Dismissible(
      key: ValueKey(id),
      background: _swipeBackground(
        context,
        color: sem.accent.withValues(alpha: 0.14),
        icon: done ? Icons.undo : Icons.check_circle_outline,
        iconColor: sem.accent,
        alignLeft: true,
        label: done ? 'Reopen' : 'Done',
      ),
      secondaryBackground: _swipeBackground(
        context,
        color: sem.marker.withValues(alpha: 0.1),
        icon: Icons.delete_outline,
        iconColor: sem.marker,
        alignLeft: false,
        label: 'Delete',
      ),
      confirmDismiss: (direction) async {
        if (direction == DismissDirection.startToEnd) {
          onToggleDone();
          return false;
        }
        onDelete();
        return true;
      },
      child: child,
    );
  }

  Widget _swipeBackground(
    BuildContext context, {
    required Color color,
    required IconData icon,
    required Color iconColor,
    required bool alignLeft,
    required String label,
  }) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 6),
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall!.copyWith(
                fontSize: 9,
                letterSpacing: 1,
                color: iconColor,
              ),
        ),
      ],
    );
    return Container(
      alignment: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: color,
      child: content,
    );
  }
}

/// the row body: overdue rail · check · title + chips (+ notes) · edit
class TaskTile extends StatelessWidget {
  final bool done;
  final bool overdue;
  final String title;
  final String? notes;
  final List<Widget> chips;
  final VoidCallback onToggle;
  final VoidCallback? onEdit;

  const TaskTile({
    super.key,
    required this.done,
    required this.onToggle,
    this.overdue = false,
    required this.title,
    this.notes,
    this.chips = const [],
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final sem = context.sem;
    return ClipRRect(
      borderRadius: BorderRadius.circular(kRadiusCard),
      child: ColoredBox(
        color: overdue && !done ? sem.marker.withValues(alpha: 0.045) : Colors.transparent,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // overdue rail
            Container(width: 3, color: overdue && !done ? sem.marker : Colors.transparent),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: CheckDot(done: done, onTap: onToggle),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                                  fontWeight: FontWeight.w500,
                                  decoration: done ? TextDecoration.lineThrough : null,
                                  color: done ? sem.inkSoft : sem.ink,
                                ),
                          ),
                          if (chips.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Wrap(spacing: 6, runSpacing: 4, children: chips),
                          ],
                          if (notes != null && notes!.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              notes!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall!
                                  .copyWith(color: sem.inkSoft),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (onEdit != null) ...[
                      const SizedBox(width: 4),
                      SemIconButton(
                        icon: Icons.edit_outlined,
                        size: 16,
                        onPressed: onEdit,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// subject + due + priority chips as the TaskTile expects them
List<Widget> taskChips(
  BuildContext context, {
  Subject? subject,
  String? due,
  required bool done,
  Priority? priority,
}) {
  return [
    if (subject != null) SubjectTag(subject.name, subject.color),
    if (due != null) DueChip(due, done: done),
    if (priority != null) PriorityBadge(priority),
  ];
}
