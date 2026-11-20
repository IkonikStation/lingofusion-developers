"""Create and verify project-scoped, zero-spend Cloud Run controls."""
import json
import os
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    project, number, account = sys.argv[1:]
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project) or not number.isdigit():
        raise SystemExit("Invalid Google Cloud project identity.")
    if not re.fullmatch(r"[A-F0-9]{6}(?:-[A-F0-9]{6}){2}", account):
        raise SystemExit("Invalid Google Cloud billing account ID.")
    if os.environ.get("PIPER_APPROVED_BILLING_ACCOUNT") != account:
        raise SystemExit("The exact billing account and residual overage risk require explicit approval.")
    token = subprocess.check_output(
        [os.environ.get("GCLOUD_BIN", "gcloud"), "auth", "print-access-token"], text=True,
    ).strip()
    endpoint = f"https://billingbudgets.googleapis.com/v1/billingAccounts/{account}/budgets"
    headers = {
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": project,
        "Content-Type": "application/json",
    }

    def budget_api(page="", body=None):
        url = endpoint + ("?" + urlencode({"pageToken": page}) if page else "")
        data = None if body is None else json.dumps(body).encode()
        try:
            with urlopen(Request(url, headers=headers, data=data), timeout=20) as response:
                return json.load(response)
        except HTTPError as error:
            detail = json.load(error).get("error", {}).get("message", "")
            raise SystemExit(f"Billing Budget API returned HTTP {error.code}. {detail}") from None

    budgets = []
    page = ""
    while True:
        listed = budget_api(page)
        budgets.extend(listed.get("budgets", []))
        page = listed.get("nextPageToken")
        if not page:
            break

    base_scope = {"projects": [f"projects/{number}"], "calendarPeriod": "MONTH"}
    notifications = {"enableProjectLevelRecipients": True}
    thresholds = [{"thresholdPercent": value} for value in (0.5, 0.8, 1)]
    configurations = [
        {
            "displayName": f"{project} Cloud Run zero spend",
            "budgetFilter": {**base_scope, "services": ["services/152E-C115-5142"],
                             "creditTypesTreatment": "EXCLUDE_ALL_CREDITS"},
            "amount": {"specifiedAmount": {"units": "0", "nanos": 0}},
            "thresholdRules": thresholds,
            "notificationsRule": notifications,
            "spendCap": {"inputState": "CONFIGURED"},
        },
        {
            "displayName": f"{project} net cost alerts",
            "budgetFilter": {**base_scope, "creditTypesTreatment": "INCLUDE_ALL_CREDITS"},
            "amount": {"specifiedAmount": {"units": "0", "nanos": 10_000_000}},
            "thresholdRules": [{"thresholdPercent": 1}],
            "notificationsRule": notifications,
        },
    ]
    for config in configurations:
        matches = [budget for budget in budgets if budget["displayName"] == config["displayName"]]
        if len(matches) > 1:
            raise SystemExit(f"Resolve duplicate budgets for {config['displayName']}.")
        saved = matches[0] if matches else budget_api(body=config)
        for field in ("budgetFilter", "notificationsRule"):
            if any(saved.get(field, {}).get(key) != value for key, value in config[field].items()):
                raise SystemExit(f"Review the existing {config['displayName']} budget before proceeding.")
        expected = config["amount"]["specifiedAmount"]
        amount = saved.get("amount", {}).get("specifiedAmount", {})
        if int(amount.get("units", 0)) != int(expected["units"]) or amount.get("nanos", 0) != expected["nanos"]:
            raise SystemExit(f"Unexpected amount on {config['displayName']}.")
        if "spendCap" in config and saved.get("spendCap", {}).get("outputState") != "CONFIGURED":
            raise SystemExit("The zero-spend Cloud Run cap is not configured. Deployment stopped.")
        print(f"Verified {config['displayName']} ({amount.get('currencyCode', 'account currency')}).")


if __name__ == "__main__":
    main()
