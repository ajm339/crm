import { describe, expect, it } from "bun:test";
import { openableUrl } from "../lib/openable-url";

describe("which field values get an open-in-new-tab link", () => {
	it("opens a text value that is only an http(s) URL", () => {
		expect(openableUrl("https://www.google.com/maps/place/Joe")).toBe(
			"https://www.google.com/maps/place/Joe",
		);
		expect(openableUrl("  http://example.com/a?b=1  ")).toBe(
			"http://example.com/a?b=1",
		);
	});

	it("does not open a sentence that contains a URL", () => {
		expect(openableUrl("Found on https://yelp.com/biz/joe")).toBeNull();
		expect(openableUrl("https://yelp.com/biz/joe and more")).toBeNull();
	});

	it("does not open plain text, empty values or other schemes", () => {
		expect(openableUrl("Joe's Garage")).toBeNull();
		expect(openableUrl("")).toBeNull();
		expect(openableUrl(null)).toBeNull();
		expect(openableUrl("javascript:alert(1)")).toBeNull();
		expect(openableUrl("mailto:joe@example.com")).toBeNull();
		expect(openableUrl("https://")).toBeNull();
		expect(openableUrl("https://localhost")).toBeNull();
	});

	it("treats a bare domain as text unless the field is a URL field", () => {
		expect(openableUrl("stripe.com")).toBeNull();
		expect(openableUrl("stripe.com", { assumeHttps: true })).toBe(
			"https://stripe.com",
		);
		expect(openableUrl("joe", { assumeHttps: true })).toBeNull();
		expect(
			openableUrl("javascript:alert(1)", { assumeHttps: true }),
		).toBeNull();
	});
});
