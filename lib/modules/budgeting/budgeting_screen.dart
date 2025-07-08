import 'package:flutter/material.dart';

/// Simple budgeting screen that displays mock budget information in a card.
class BudgetingScreen extends StatelessWidget {
  const BudgetingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const double budgetLimit = 1000;
    const double amountSpent = 450;
    final double remaining = budgetLimit - amountSpent;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Budgeting'),
      ),
      body: Center(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final double cardWidth =
                constraints.maxWidth < 600 ? constraints.maxWidth * 0.9 : 600;
            return Card(
              elevation: 4,
              margin: const EdgeInsets.all(16),
              child: Container(
                width: cardWidth,
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Monthly Budget',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 16),
                    _buildBudgetRow('Budget Limit', '\$${budgetLimit.toStringAsFixed(2)}'),
                    _buildBudgetRow('Amount Spent', '\$${amountSpent.toStringAsFixed(2)}'),
                    const Divider(height: 32),
                    _buildBudgetRow(
                      'Remaining',
                      '\$${remaining.toStringAsFixed(2)}',
                      isBold: true,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBudgetRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: isBold ? const TextStyle(fontWeight: FontWeight.bold) : null,
          ),
        ],
      ),
    );
  }
}
