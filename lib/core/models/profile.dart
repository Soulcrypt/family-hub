enum UserRole { parent, kid, admin }

class UserProfile {
  final String id;
  final UserRole role;
  final List<String> visibleModules;

  const UserProfile({
    required this.id,
    required this.role,
    required this.visibleModules,
  });
}
