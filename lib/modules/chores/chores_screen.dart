import 'package:flutter/material.dart';

class ChoresScreen extends StatelessWidget {
  const ChoresScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const chores = [
      'Take out the trash',
      'Do the dishes',
      'Clean your room',
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chores'),
      ),
      body: ListView.builder(
        itemCount: chores.length,
        itemBuilder: (context, index) {
          return ListTile(
            leading: const Icon(Icons.check_box_outline_blank),
            title: Text(chores[index]),
          );
        },
      ),
    );
  }
}
