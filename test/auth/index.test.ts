import request from "supertest";
import app from "../../src/app";

// Mock the dependencies
jest.mock("../../src/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

describe("GET /v1/auth/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test_secret";
  });

  it("should return 401 if auth header is missing", async () => {
    await request(app)
      .get("/v1/auth/")
      .expect(401, { error: "Authorization header missing or invalid." });
  });

  it("should return 401 if auth header is malformed", async () => {
    await request(app)
      .get("/v1/auth/")
      .set("Authorization", "InvalidTokenFormat")
      .expect(401, { error: "Authorization header missing or invalid." });
  });

  it("should return 400 if JWT is malformed", async () => {
    await request(app)
      .get("/v1/auth/")
      .set("Authorization", "Bearer InvalidJWT")
      .expect(400, { error: "JWT error: the token may be malformed" });
  });

  test.todo("should return 404 if user is not found");

  test.todo("should reject request if JWT is expired");

  test.todo("should return 200 with user data when all is OK");
});
