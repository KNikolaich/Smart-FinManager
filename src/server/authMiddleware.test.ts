import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  verify: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: { verify: fake.verify },
}));
vi.mock("../../server/prisma", () => ({
  prisma: { user: { findUnique: fake.findUnique } },
}));
vi.mock("../../server/config", () => ({
  JWT_SECRET_VALUE: "test-secret",
}));

import { authenticateToken } from "../../server/authMiddleware";

const createResponse = () => {
  const response: any = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe("authenticateToken", () => {
  beforeEach(() => {
    fake.verify.mockReset();
    fake.findUnique.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 for an invalid token without querying the user table", async () => {
    fake.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const req: any = {
      method: "GET",
      path: "/api/initial-data",
      headers: { authorization: "Bearer expired-token" },
    };
    const res = createResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(fake.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when the database user lookup fails", async () => {
    fake.verify.mockReturnValue({ userId: "user-1" });
    fake.findUnique.mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const req: any = {
      method: "GET",
      path: "/api/initial-data",
      headers: { authorization: "Bearer valid-token" },
    };
    const res = createResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication service unavailable" });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the verified user and continues", async () => {
    fake.verify.mockReturnValue({ userId: "user-1" });
    fake.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "user",
    });

    const req: any = {
      method: "GET",
      path: "/api/initial-data",
      headers: { authorization: "Bearer valid-token" },
    };
    const res = createResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      userId: "user-1",
      email: "user@example.com",
      role: "user",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});