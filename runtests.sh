cd tests
newman run -e api_tests.postman_environment.json api_tests.postman_collection.json

# adapted from challenge 7-1 6-1 and 5-2 and got help from chatgpt with tempfile
HOST=localhost
PORT=8000

BASEURL="http://${HOST}:${PORT}"

GREEN=$(tput setaf 10)
RESET=$(tput sgr0)

status() {
    printf "\n%s+=====================================================\n" "$GREEN"
    printf "| %s\n" "$*"
    printf "+=====================================================\n%s" "$RESET"
}

tempfile=curl.out.$$.tmp

status POST /users
curl -s -X POST \
    ${BASEURL}/users -H 'Content-Type: application/json' \
      -d '{"name": "Tyler", "email": "realemail@website.com", "password": "hunter2"}'

status POST /users/login
curl -s -X POST \
    ${BASEURL}/users/login -H 'Content-Type: application/json' \
      -d '{"email": "joel@lickspigot.com", "password": "hunter2"}' | tee "$tempfile"
    #got help from chatgpt with this line
    token=$(awk -F'"token":"' '{print $2}' "$tempfile" | awk -F'"' '{print $1}')
    auth="Authorization: Bearer $token"


status GET /users/{userId}
curl -s -H "$auth" ${BASEURL}/users/3

status GET /users/{userId}/businesses
curl -s -H "$auth" ${BASEURL}/users/3/businesses

status GET /users/{userId}/photos
curl -s -H "$auth" ${BASEURL}/users/3/photos

status GET /users/{userId}/reviews
curl -s -H "$auth" ${BASEURL}/users/3/reviews

status POST /businesses
curl -s -X POST \
    ${BASEURL}/businesses -H "$auth" -H 'Content-Type: application/json' \
      -d '{"name": "Brunos", "address": "6th st.", "city": "Bemd", "state": "OR", "zip": "97333", "phone": "541-752-5952", "category": "Fud", "subcategory": "Gud"}' | tee "$tempfile"
    businessid=$(awk -F: '{print $2}' "$tempfile" | awk -F, '{print $1}' | tr -d '"')

status PUT /businesses
curl -s -X PUT \
    ${BASEURL}/businesses/$businessid -H "$auth" -H 'Content-Type: application/json' \
      -d '{"name": "Brunos", "address": "6th st.", "city": "Bemd", "state": "OR", "zip": "97333", "phone": "541-752-5952", "category": "Fud", "subcategory": "Gud"}'

status DELETE /businesses
curl -X DELETE -H "$auth" ${BASEURL}/businesses/$businessid

status POST /photos
curl -s -X POST \
    ${BASEURL}/photos -H "$auth" -H 'Content-Type: application/json' \
      -d '{"businessid": 18, "caption": "Pizza"}' | tee "$tempfile"
    photoid=$(awk -F: '{print $2}' "$tempfile" | awk -F, '{print $1}' | tr -d '"')

status PUT /photos
curl -s -X PUT \
    ${BASEURL}/photos/$photoid -H "$auth" -H 'Content-Type: application/json' \
      -d '{"businessid": 18, "caption": "Pizza"}'

status DELETE /photos
curl -X DELETE -H "$auth" ${BASEURL}/photos/$photoid

status POST /reviews
curl -s -X POST \
    ${BASEURL}/reviews -H "$auth" -H 'Content-Type: application/json' \
      -d '{"businessid": 18, "dollars": 1, "stars": 5, "review": "Pizza"}' | tee "$tempfile"
    reviewid=$(awk -F: '{print $2}' "$tempfile" | awk -F, '{print $1}' | tr -d '"')

status PUT /reviews
curl -s -X PUT \
    ${BASEURL}/reviews/$reviewid -H "$auth" -H 'Content-Type: application/json' \
      -d '{"businessid": 18, "dollars": 1, "stars": 5, "review": "Pizza"}'

status DELETE /reviews
curl -X DELETE -H "$auth" ${BASEURL}/reviews/$reviewid