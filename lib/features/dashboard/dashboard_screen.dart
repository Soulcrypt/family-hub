import 'package:flutter/material.dart';
import '../../shared/widgets/module_tile.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Hub'),
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Dashboard Placeholder',
              style: TextStyle(fontSize: 24),
            ),
            const SizedBox(height: 16),
            const ModuleTile(
              moduleName: 'Calendar',
              icon: Icons.event,
            ),
            const ModuleTile(
              moduleName: 'Budgeting',
              icon: Icons.attach_money,
            ),
            const ModuleTile(
              moduleName: 'Chores',
              icon: Icons.check_box,
            ),
            const ModuleTile(
              moduleName: 'Settings',
              icon: Icons.settings,
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => context.go('/profiles'),
              child: const Text('View Profiles'),
            ),
          ],
        ),
      ),
    );
  }
}
