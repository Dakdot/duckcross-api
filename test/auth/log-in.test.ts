import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../../src/app";
import { db } from "../../src/lib/db";

// Mock the dependencies
jest.mock("../../src/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

describe("POST /v1/auth/login", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test_secret";
  });

  it("should return 400 if email is missing", async () => {
    await request(app)
      .post("/v1/auth/login")
      .send({ password: "password123" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(400, { error: "Missing credentials" });
  });

  it("should return 400 if password is missing", async () => {
    await request(app)
      .post("/v1/auth/login")
      .send({ email: "test@example.com" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(400, { error: "Missing credentials" });
  });

  it("should return 401 if user is not found", async () => {
    // Mock the user findUnique to return null (user not found)
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);

    await request(app)
      .post("/v1/auth/login")
      .send({ email: "nonexistent@example.com", password: "password123" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(401, { error: "Invalid credentials" });

    // Verify that findUnique was called with the correct email
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "nonexistent@example.com" },
    });
  });

  it("should return 401 if password does not match", async () => {
    // Mock user being found
    const mockUser = {
      id: 1,
      email: "test@example.com",
      password: "hashedPassword",
      name: "Test User",
      refreshToken: null,
      refreshTokenCreatedAt: null,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // Mock password comparison to fail
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await request(app)
      .post("/v1/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(401, { error: "Invalid credentials" });

    // Verify bcrypt.compare was called with the correct arguments
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "wrongpassword",
      "hashedPassword"
    );
  });

  it("should return 200 and tokens if credentials are valid", async () => {
    // Mock user being found
    const mockUser = {
      id: 1,
      email: "test@example.com",
      password: "hashedPassword",
      name: "Test User",
      refreshToken: null,
      refreshTokenCreatedAt: null,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // Mock password comparison to succeed
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Mock JWT token creation
    const mockAccessToken = "mock-access-token";
    const mockRefreshToken = "mock-refresh-token";

    (jwt.sign as jest.Mock).mockImplementation((payload, secret, options) => {
      if (options.expiresIn === "30m") return mockAccessToken;
      if (options.expiresIn === "30d") return mockRefreshToken;
      return "";
    });

    // Mock db update
    (db.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      refreshToken: mockRefreshToken,
      refreshTokenCreatedAt: new Date(),
    });

    const response = await request(app)
      .post("/v1/auth/login")
      .send({ email: "test@example.com", password: "correctpassword" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200);

    // Check the response structure
    expect(response.body).toEqual({
      message: "Log in was successful.",
      user: {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        isAdmin: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        refreshTokenCreatedAt: expect.any(String),
      },
      accessToken: mockAccessToken,
    });

    // Verify that user was updated with refresh token
    expect(db.user.update).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      data: {
        refreshToken: mockRefreshToken,
        refreshTokenCreatedAt: expect.any(Date),
      },
    });

    // Verify that the refresh token cookie was set
    const setCookieHeader = response.headers["set-cookie"];
    expect(setCookieHeader).toBeDefined();

    // Convert to string if it's an array (handling both possible types)
    const cookieString = Array.isArray(setCookieHeader)
      ? setCookieHeader.join("; ")
      : String(setCookieHeader);

    // Check that the cookie string contains our expected values
    expect(cookieString).toContain("DC_REFRESH_TOKEN=mock-refresh-token");
    expect(cookieString).toContain("HttpOnly");
    expect(cookieString).toContain("Path=/v1/auth/refresh");
  });

  it("should return 500 if an error occurs", async () => {
    // Mock an unexpected error
    (db.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("Database error")
    );

    // Spy on console.trace
    const consoleTraceSpy = jest.spyOn(console, "trace").mockImplementation();

    await request(app)
      .post("/v1/auth/login")
      .send({ email: "test@example.com", password: "password123" })
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(500, { error: "Internal server error" });

    // Verify that console.trace was called with the error
    expect(consoleTraceSpy).toHaveBeenCalled();

    // Restore console.trace
    consoleTraceSpy.mockRestore();
  });
});
