import '../models/profile.dart';

class ProfileService {
  ProfileService();

  final List<UserProfile> _mockProfiles = const [
    UserProfile(
      id: 'parent1',
      role: UserRole.parent,
      visibleModules: ['calendar', 'chores', 'shopping'],
    ),
    UserProfile(
      id: 'kid1',
      role: UserRole.kid,
      visibleModules: ['calendar', 'games'],
    ),
    UserProfile(
      id: 'admin1',
      role: UserRole.admin,
      visibleModules: ['calendar', 'chores', 'shopping', 'settings'],
    ),
  ];

  List<UserProfile> getAllProfiles() => List.unmodifiable(_mockProfiles);

  UserProfile? getProfileById(String id) {
    try {
      return _mockProfiles.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }
}
