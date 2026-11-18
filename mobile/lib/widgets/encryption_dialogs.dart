import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../appwrite/sync.dart';
import '../crypto/keyring.dart';

/// Shows the two encryption moments: the one-time recovery code after a new
/// key is created, and the unlock prompt when this device does not hold the
/// key (password reset, new device without the cached key).
Future<void> showEncryptionDialogs(BuildContext context) async {
  final e2ee = E2ee.instance;
  final code = e2ee.takeRecoveryKey();
  if (code != null) {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RecoveryKeyDialog(code: code),
    );
  }
  // the caller's widget may be gone once the recovery dialog closed
  if (!context.mounted) return;
  if (e2ee.status == E2eeStatus.locked) {
    await showDialog<void>(
      context: context,
      builder: (_) => const _UnlockDialog(),
    );
  }
}

class _RecoveryKeyDialog extends StatefulWidget {
  const _RecoveryKeyDialog({required this.code});

  final String code;

  @override
  State<_RecoveryKeyDialog> createState() => _RecoveryKeyDialogState();
}

class _RecoveryKeyDialogState extends State<_RecoveryKeyDialog> {
  bool _saved = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Your recovery key'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Your notes, tasks and study-room content are encrypted on this '
              'device before they reach the cloud. Save this key somewhere '
              'safe — it is the only way back into your data if you forget '
              'your password.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: theme.dividerColor),
                borderRadius: BorderRadius.circular(12),
              ),
              child: SelectableText(
                widget.code,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontFamily: 'IBM Plex Mono',
                  letterSpacing: 0.4,
                ),
              ),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _saved,
              onChanged: (value) => setState(() => _saved = value ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(
                'I stored this key somewhere other than this device.',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton.icon(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: widget.code));
            if (mounted) setState(() => _saved = true);
          },
          icon: const Icon(Icons.copy, size: 16),
          label: const Text('Copy'),
        ),
        FilledButton(
          onPressed: _saved ? () => Navigator.of(context).pop() : null,
          child: const Text('Done'),
        ),
      ],
    );
  }
}

class _UnlockDialog extends StatefulWidget {
  const _UnlockDialog();

  @override
  State<_UnlockDialog> createState() => _UnlockDialogState();
}

class _UnlockDialogState extends State<_UnlockDialog> {
  final _secret = TextEditingController();
  bool _useRecovery = false;
  bool _busy = false;
  String _error = '';

  @override
  void dispose() {
    _secret.dispose();
    super.dispose();
  }

  Future<void> _unlock() async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      if (_useRecovery) {
        await E2ee.instance.unlockWithRecoveryKey(_secret.text);
      } else {
        await E2ee.instance.unlockWithPassword(_secret.text);
      }
      await syncNow();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_useRecovery ? 'Recovery key' : 'Unlock encrypted sync'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Sync is paused because this device does not hold your data key. '
            'Your local data is still here.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _secret,
            autofocus: true,
            obscureText: !_useRecovery,
            autocorrect: false,
            enableSuggestions: false,
            decoration: InputDecoration(
              labelText: _useRecovery ? 'Recovery key' : 'Account password',
              border: const OutlineInputBorder(),
            ),
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _error,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _useRecovery = !_useRecovery;
                      _secret.clear();
                      _error = '';
                    }),
            child: Text(
              _useRecovery ? 'Use my password instead' : 'Use a recovery key',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Not now'),
        ),
        FilledButton(
          onPressed: _busy ? null : _unlock,
          child: Text(_busy ? 'Unlocking…' : 'Unlock'),
        ),
      ],
    );
  }
}
