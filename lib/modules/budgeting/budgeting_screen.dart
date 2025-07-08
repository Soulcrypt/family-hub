import 'package:flutter/material.dart';

class BudgetingScreen extends StatelessWidget {
  const BudgetingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const categories = [
      'Groceries',
      'Utilities',
      'Entertainment',
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Budgeting'),
      ),
      body: ListView.builder(
        itemCount: categories.length,
        itemBuilder: (context, index) {
          return ListTile(
            leading: const Icon(Icons.attach_money),
            title: Text(categories[index]),
          );
        },
      ),
    );
  }
}
