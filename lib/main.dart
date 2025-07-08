import 'package:flutter/material.dart';
import 'core/services/navigation_router.dart';

void main() {
  runApp(const FamilyHubApp());
}

class FamilyHubApp extends StatelessWidget {
  const FamilyHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Family Hub',
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        colorSchemeSeed: Colors.teal,
      ),
      routerConfig: appRouter,
    );
  }
}

