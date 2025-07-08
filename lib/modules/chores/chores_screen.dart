import 'package:flutter/material.dart';

/// Simple chores module displaying a list of tasks with checkboxes.
class ChoreTask {
  ChoreTask({
    required this.title,
    required this.assignedTo,
    this.completed = false,
  });

  final String title;
  final String assignedTo;
  bool completed;
}

class ChoresScreen extends StatefulWidget {
  const ChoresScreen({super.key});

  @override
  State<ChoresScreen> createState() => _ChoresScreenState();
}

class _ChoresScreenState extends State<ChoresScreen> {
  final List<ChoreTask> _chores = [
    ChoreTask(title: 'Take out the trash', assignedTo: 'Alice'),
    ChoreTask(title: 'Do the dishes', assignedTo: 'Bobby'),
    ChoreTask(title: 'Clean your room', assignedTo: 'Charlie'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chores'),
      ),
      body: ListView.builder(
        itemCount: _chores.length,
        itemBuilder: (context, index) {
          final chore = _chores[index];
          return CheckboxListTile(
            title: Text(chore.title),
            subtitle: Text('Assigned to ${chore.assignedTo}'),
            value: chore.completed,
            onChanged: (value) {
              setState(() {
                chore.completed = value ?? false;
              });
            },
          );
        },
      ),
    );
  }
}
