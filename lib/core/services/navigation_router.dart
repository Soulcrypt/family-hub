import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/dashboard/dashboard_screen.dart';
import '../../modules/calendar/calendar_screen.dart';
import '../../modules/budgeting/budgeting_screen.dart';
import '../../modules/chores/chores_screen.dart';
import '../../modules/settings/settings_screen.dart';
import '../../features/profiles/profiles_screen.dart';
import '../../features/settings/profile_switch_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/dashboard',
  routes: [
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/calendar',
      builder: (context, state) => const CalendarModule(),
    ),
    GoRoute(
      path: '/budget',
      builder: (context, state) => const BudgetingScreen(),
    ),
    GoRoute(
      path: '/chores',
      builder: (context, state) => const ChoresScreen(),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      path: '/switch-profile',
      builder: (context, state) => const ProfileSwitchScreen(),
    ),
    GoRoute(
      path: '/profiles',
      builder: (context, state) => const ProfilesScreen(),
    ),
  ],
);
