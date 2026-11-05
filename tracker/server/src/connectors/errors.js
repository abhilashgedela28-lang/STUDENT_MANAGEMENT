class PlatformError extends Error {
  constructor(message, platform) {
    super(message);
    this.name = this.constructor.name;
    this.platform = platform;
    Error.captureStackTrace(this, this.constructor);
  }
}

class PlatformUnavailableError extends PlatformError {
  constructor(platform, originalError = null) {
    super(`${platform} service is temporarily unavailable or unreachable.`, platform);
    this.originalError = originalError ? originalError.message : null;
  }
}

class RateLimitedError extends PlatformError {
  constructor(platform, retryAfter = 60) {
    super(`${platform} rate limit reached. Please try again later.`, platform);
    this.retryAfter = retryAfter;
  }
}

class UserNotFoundError extends PlatformError {
  constructor(platform, username) {
    super(`User '${username}' was not found on ${platform}.`, platform);
    this.username = username;
  }
}

class MalformedResponseError extends PlatformError {
  constructor(platform, details) {
    super(`Received malformed or unexpected data from ${platform}: ${details}`, platform);
    this.details = details;
  }
}

module.exports = {
  PlatformError,
  PlatformUnavailableError,
  RateLimitedError,
  UserNotFoundError,
  MalformedResponseError,
};
