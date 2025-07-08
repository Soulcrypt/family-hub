import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'features/dashboard/dashboard_screen.dart';
import 'modules/calendar/calendar_screen.dart';
import 'modules/budgeting/budgeting_screen.dart';
import 'features/profiles/profiles_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/dashboard',
  routes: [
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/calendar',
      builder: (context, state) => const CalendarScreen(),
    ),
    GoRoute(
      path: '/budgeting',
      builder: (context, state) => const BudgetingScreen(),
    ),
    GoRoute(
      path: '/profiles',
      builder: (context, state) => const ProfilesScreen(),
    ),
  ],
);
