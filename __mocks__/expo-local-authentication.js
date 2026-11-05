module.exports = {
  getEnrolledLevelAsync: jest.fn().mockResolvedValue(3),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
};
