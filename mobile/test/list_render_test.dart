import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:semester/models/types.dart';
import 'package:semester/pages/homework_page.dart';
import 'package:semester/pages/todos_page.dart';
import 'package:semester/stores/homework_store.dart';
import 'package:semester/stores/registry.dart';
import 'package:semester/stores/todos_store.dart';
import 'package:semester/theme/app_theme.dart';

void main() {
  testWidgets('todos list shows seeded items', (tester) async {
    SharedPreferences.setMockInitialValues({});
    Stores.I.loadAll(await SharedPreferences.getInstance());
    Stores.I.todos.addTodo(const TodoInput('Rendered task', priority: Priority.high));

    await tester.pumpWidget(MaterialApp(
      theme: buildSemesterTheme(dark: false),
      home: const Scaffold(body: TodosPage()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Rendered task'), findsOneWidget);
  });

  testWidgets('homework list shows seeded items', (tester) async {
    SharedPreferences.setMockInitialValues({});
    Stores.I.loadAll(await SharedPreferences.getInstance());
    Stores.I.homework.addHomework(const HomeworkInput('Rendered homework', priority: Priority.low));

    await tester.pumpWidget(MaterialApp(
      theme: buildSemesterTheme(dark: false),
      home: const Scaffold(body: HomeworkPage()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Rendered homework'), findsOneWidget);
  });
}
