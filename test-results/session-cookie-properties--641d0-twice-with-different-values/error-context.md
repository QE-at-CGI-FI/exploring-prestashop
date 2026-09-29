# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: session-cookie-properties.spec.js >> Session cookie properties (antithesis-research property catalog) >> duplicate-session-cookie-single-write: no response sets the same cookie twice with different values
- Location: tests/session-cookie-properties.spec.js:85:3

# Error details

```
Error: PrestaShop-86fce55cad942ed59f2bbba85dc3f9a1 was set 2 times with different values in one response:
PrestaShop-86fce55cad942ed59f2bbba85dc3f9a1=def5020003273b028a5377bf020bb03f76ffd3c2025943a265d440964727d989729c4c8ce7fa169f65a385725d0d37313772169572dab3c4663acf3fbcb8140affdffb13236bd14e4036835055b45cead2190da305cfd4432eafd361a9eaccc3a4d23eeb30ab9c8d13f6dfc69264de767a92c9c93026214b18e7cbe6c3bb3fb9d9dd039249635f9a95d6def6b212c72e90cba0d91225948aa908586327b828682124defa59d7102c94ec4ed573e7b807067890cd040fcf9b2dbd12a2e22da087d641c5e76c5ac24a53dacbd13b5ed1e74f77cb6e1a38db0827a41a37018b59773ebb91b34d91bcd406fe; expires=Mon, 19 Oct 2026 19:35:07 GMT; Max-Age=1728000; path=/; HttpOnly; SameSite=Lax
PrestaShop-86fce55cad942ed59f2bbba85dc3f9a1=def50200ae7003bb14232af3861842184ee5e153ef5d5acdfc48d9db7a47cf67b117215829e366b09b7e7ed3cee5f247b54d90bd3f134d93b11e483eee77aac4d0f6164e1219b7ed35692854eb3df300b5625fdd050845c64c1606f6b40f6c8e06138fbc0fe1682423b7cc5d5f732ab0fe8723f8979cf60610c871d4bdda26ddc989f56945a3f31a35af5bd3de32583a3d2631d626b13c792b3cc4d35d9a7ed92eb81b484f0c760b3e5e502c34badb20c1407fd21cd751e326c4a64f1c59104086a2b49aa741d43b90ad102c1bb4b109a3b26bcf46dc74a37296b5ca83a94fc724533eaea903fe79eaff1408652c5d3cd564942b0e3f77ccd171a2f794bc2c7d14fd725920bddf78cc3f; expires=Mon, 19 Oct 2026 19:35:07 GMT; Max-Age=1728000; path=/; HttpOnly; SameSite=Lax

expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 2
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e6]:
      - link "Contact us" [ref=e10] [cursor=pointer]:
        - /url: http://localhost:8080/contact-us
      - generic [ref=e11]:
        - combobox "Change currency" [ref=e14] [cursor=pointer]:
          - option "EUR €" [selected]
          - option "USD $"
        - link "Sign in" [ref=e18] [cursor=pointer]:
          - /url: http://localhost:8080/login?back=http%3A%2F%2Flocalhost%3A8080%2F
          - generic [ref=e19]: 
        - generic [ref=e24]:
          - generic [ref=e25]: 
          - generic [ref=e26]: Cart
          - generic [ref=e27]: "0"
    - generic [ref=e30]:
      - heading [level=1] [ref=e32]:
        - link [ref=e33] [cursor=pointer]:
          - /url: http://localhost:8080/
          - img "PrestaShop" [ref=e34]
      - navigation "Main navigation" [ref=e36]:
        - list [ref=e37]:
          - listitem [ref=e38]:
            - generic [ref=e39]:
              - link "Clothes" [ref=e40] [cursor=pointer]:
                - /url: http://localhost:8080/3-clothes
              - button "Open Clothes submenu" [ref=e41] [cursor=pointer]: 
          - listitem [ref=e42]:
            - generic [ref=e43]:
              - link "Accessories" [ref=e44] [cursor=pointer]:
                - /url: http://localhost:8080/6-accessories
              - button "Open Accessories submenu" [ref=e45] [cursor=pointer]: 
          - listitem [ref=e46]:
            - link "Art" [ref=e48] [cursor=pointer]:
              - /url: http://localhost:8080/9-art
      - search [ref=e51]:
        - generic [ref=e52] [cursor=pointer]: 
        - combobox "Search" [ref=e53]
  - main [ref=e54]:
    - generic [ref=e56]:
      - generic [ref=e58]:
        - generic [ref=e59]:
          - button "Go to slide 1" [ref=e60] [cursor=pointer]
          - button "Go to slide 2" [ref=e61] [cursor=pointer]
          - button "Go to slide 3" [ref=e62] [cursor=pointer]
        - list "Carousel container" [ref=e63]:
          - listitem [ref=e64]:
            - link [ref=e65] [cursor=pointer]:
              - /url: https://www.prestashop-project.org
              - figure [ref=e66]:
                - img "sample-1" [ref=e67]
                - generic [ref=e68]:
                  - heading "Sample 1" [level=2] [ref=e69]
                  - generic [ref=e70]:
                    - heading "EXCEPTEUR OCCAECAT" [level=3] [ref=e71]
                    - paragraph [ref=e72]: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin tristique in tortor et dignissim. Quisque non tempor leo. Maecenas egestas sem elit
        - button "Previous" [ref=e73] [cursor=pointer]:
          - generic [ref=e74]: 
        - button "Next" [ref=e75] [cursor=pointer]:
          - generic [ref=e76]: 
      - generic [ref=e78]:
        - heading "Custom Text Block" [level=2] [ref=e79]
        - paragraph [ref=e80]:
          - strong [ref=e81]: Lorem ipsum dolor sit amet conse ctetu
        - paragraph [ref=e82]: Sit amet conse ctetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.
      - generic [ref=e84]:
        - heading "Featured products" [level=2] [ref=e85]
        - generic [ref=e87]:
          - article [ref=e88]:
            - generic [ref=e89]:
              - generic [ref=e90]:
                - list:
                  - listitem: "-20%"
                  - listitem: New
                - link [ref=e92] [cursor=pointer]:
                  - /url: http://localhost:8080/1-1-hummingbird-printed-t-shirt.html#/1-size-s/8-color-white
                  - img "Hummingbird printed t-shirt" [ref=e94]
                - button "Quick view Hummingbird printed t-shirt" [ref=e95] [cursor=pointer]:
                  - generic [ref=e96]: 
                  - text: Quick view
              - generic [ref=e97]:
                - generic [ref=e98]:
                  - link "View product Hummingbird printed t-shirt" [ref=e99] [cursor=pointer]:
                    - /url: http://localhost:8080/1-1-hummingbird-printed-t-shirt.html#/1-size-s/8-color-white
                    - text: Hummingbird printed t-shirt
                  - generic [ref=e100]:
                    - link "White - Hummingbird printed t-shirt" [ref=e101] [cursor=pointer]:
                      - /url: http://localhost:8080/1-3-hummingbird-printed-t-shirt.html#/2-size-m/8-color-white
                    - link "Black - Hummingbird printed t-shirt" [ref=e102] [cursor=pointer]:
                      - /url: http://localhost:8080/1-2-hummingbird-printed-t-shirt.html#/1-size-s/11-color-black
                  - generic [ref=e103]:
                    - generic "Price" [ref=e104]: €19.12
                    - generic [ref=e105]: €23.90
                - generic [ref=e107]:
                  - generic [ref=e109]:
                    - button "Decrease quantity of Hummingbird printed t-shirt" [ref=e110] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Hummingbird printed t-shirt" [ref=e111]: "1"
                    - button "Increase quantity of Hummingbird printed t-shirt" [ref=e112] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Hummingbird printed t-shirt" [ref=e113] [cursor=pointer]:
                    - generic [ref=e114]: 
          - article [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - list:
                  - listitem: "-20%"
                  - listitem: New
                - link [ref=e119] [cursor=pointer]:
                  - /url: http://localhost:8080/2-9-brown-bear-printed-sweater.html#/1-size-s
                  - img "Brown bear printed sweater" [ref=e121]
                - button "Quick view Hummingbird printed sweater" [ref=e122] [cursor=pointer]:
                  - generic [ref=e123]: 
                  - text: Quick view
              - generic [ref=e124]:
                - generic [ref=e125]:
                  - link "View product Hummingbird printed sweater" [ref=e126] [cursor=pointer]:
                    - /url: http://localhost:8080/2-9-brown-bear-printed-sweater.html#/1-size-s
                    - text: Hummingbird printed sweater
                  - generic [ref=e127]:
                    - generic "Price" [ref=e128]: €28.72
                    - generic [ref=e129]: €35.90
                - generic [ref=e131]:
                  - generic [ref=e133]:
                    - button "Decrease quantity of Hummingbird printed sweater" [ref=e134] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Hummingbird printed sweater" [ref=e135]: "1"
                    - button "Increase quantity of Hummingbird printed sweater" [ref=e136] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Hummingbird printed sweater" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]: 
          - article [ref=e139]:
            - generic [ref=e140]:
              - generic [ref=e141]:
                - list:
                  - listitem: New
                - link [ref=e143] [cursor=pointer]:
                  - /url: http://localhost:8080/3-13-the-best-is-yet-to-come-framed-poster.html#/19-dimension-40x60cm
                  - img "The best is yet to come' Framed poster" [ref=e145]
                - button "Quick view The best is yet to come' Framed poster" [ref=e146] [cursor=pointer]:
                  - generic [ref=e147]: 
                  - text: Quick view
              - generic [ref=e148]:
                - generic [ref=e149]:
                  - link "View product The best is yet to come' Framed poster" [ref=e150] [cursor=pointer]:
                    - /url: http://localhost:8080/3-13-the-best-is-yet-to-come-framed-poster.html#/19-dimension-40x60cm
                    - text: The best is yet to come' Framed poster
                  - generic "Price" [ref=e152]: €29.00
                - generic [ref=e154]:
                  - generic [ref=e156]:
                    - button "Decrease quantity of The best is yet to come' Framed poster" [ref=e157] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of The best is yet to come' Framed poster" [ref=e158]: "1"
                    - button "Increase quantity of The best is yet to come' Framed poster" [ref=e159] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart The best is yet to come' Framed poster" [ref=e160] [cursor=pointer]:
                    - generic [ref=e161]: 
          - article [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]:
                - list:
                  - listitem: New
                - link [ref=e166] [cursor=pointer]:
                  - /url: http://localhost:8080/4-16-the-adventure-begins-framed-poster.html#/19-dimension-40x60cm
                  - img "The adventure begins Framed poster" [ref=e168]
                - button "Quick view The adventure begins Framed poster" [ref=e169] [cursor=pointer]:
                  - generic [ref=e170]: 
                  - text: Quick view
              - generic [ref=e171]:
                - generic [ref=e172]:
                  - link "View product The adventure begins Framed poster" [ref=e173] [cursor=pointer]:
                    - /url: http://localhost:8080/4-16-the-adventure-begins-framed-poster.html#/19-dimension-40x60cm
                    - text: The adventure begins Framed poster
                  - generic "Price" [ref=e175]: €29.00
                - generic [ref=e177]:
                  - generic [ref=e179]:
                    - button "Decrease quantity of The adventure begins Framed poster" [ref=e180] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of The adventure begins Framed poster" [ref=e181]: "1"
                    - button "Increase quantity of The adventure begins Framed poster" [ref=e182] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart The adventure begins Framed poster" [ref=e183] [cursor=pointer]:
                    - generic [ref=e184]: 
        - link "All featured products" [ref=e186] [cursor=pointer]:
          - /url: http://localhost:8080/2-home
          - text: All featured products
          - generic [ref=e187]: 
      - link [ref=e190] [cursor=pointer]:
        - /url: http://localhost:8080/
      - generic [ref=e192]:
        - heading "Latest arrivals" [level=2] [ref=e193]
        - generic [ref=e195]:
          - article [ref=e196]:
            - generic [ref=e197]:
              - generic [ref=e198]:
                - list:
                  - listitem: New
                - link [ref=e200] [cursor=pointer]:
                  - /url: http://localhost:8080/19-customizable-mug.html
                  - img "Customizable mug" [ref=e202]
                - button "Quick view Customizable mug" [ref=e203] [cursor=pointer]:
                  - generic [ref=e204]: 
                  - text: Quick view
              - generic [ref=e205]:
                - generic [ref=e206]:
                  - link "View product Customizable mug" [ref=e207] [cursor=pointer]:
                    - /url: http://localhost:8080/19-customizable-mug.html
                    - text: Customizable mug
                  - generic "Price" [ref=e209]: €13.90
                - link "View product Customizable mug" [ref=e211] [cursor=pointer]:
                  - /url: http://localhost:8080/19-customizable-mug.html
                  - text: See details
          - article [ref=e212]:
            - generic [ref=e213]:
              - generic [ref=e214]:
                - list:
                  - listitem: New
                - link [ref=e216] [cursor=pointer]:
                  - /url: http://localhost:8080/18-36-hummingbird-notebook.html#/22-paper_type-ruled
                  - img "Mountain fox notebook" [ref=e218]
                - button "Quick view Hummingbird notebook" [ref=e219] [cursor=pointer]:
                  - generic [ref=e220]: 
                  - text: Quick view
              - generic [ref=e221]:
                - generic [ref=e222]:
                  - link "View product Hummingbird notebook" [ref=e223] [cursor=pointer]:
                    - /url: http://localhost:8080/18-36-hummingbird-notebook.html#/22-paper_type-ruled
                    - text: Hummingbird notebook
                  - generic "Price" [ref=e225]: €12.90
                - generic [ref=e227]:
                  - generic [ref=e229]:
                    - button "Decrease quantity of Hummingbird notebook" [ref=e230] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Hummingbird notebook" [ref=e231]: "1"
                    - button "Increase quantity of Hummingbird notebook" [ref=e232] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Hummingbird notebook" [ref=e233] [cursor=pointer]:
                    - generic [ref=e234]: 
          - article [ref=e235]:
            - generic [ref=e236]:
              - generic [ref=e237]:
                - list:
                  - listitem: New
                - link [ref=e239] [cursor=pointer]:
                  - /url: http://localhost:8080/17-32-brown-bear-notebook.html#/22-paper_type-ruled
                  - img "Mountain fox notebook" [ref=e241]
                - button "Quick view Brown bear notebook" [ref=e242] [cursor=pointer]:
                  - generic [ref=e243]: 
                  - text: Quick view
              - generic [ref=e244]:
                - generic [ref=e245]:
                  - link "View product Brown bear notebook" [ref=e246] [cursor=pointer]:
                    - /url: http://localhost:8080/17-32-brown-bear-notebook.html#/22-paper_type-ruled
                    - text: Brown bear notebook
                  - generic "Price" [ref=e248]: €12.90
                - generic [ref=e250]:
                  - generic [ref=e252]:
                    - button "Decrease quantity of Brown bear notebook" [ref=e253] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Brown bear notebook" [ref=e254]: "1"
                    - button "Increase quantity of Brown bear notebook" [ref=e255] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Brown bear notebook" [ref=e256] [cursor=pointer]:
                    - generic [ref=e257]: 
          - article [ref=e258]:
            - generic [ref=e259]:
              - generic [ref=e260]:
                - list:
                  - listitem: New
                - link [ref=e262] [cursor=pointer]:
                  - /url: http://localhost:8080/16-28-mountain-fox-notebook.html#/22-paper_type-ruled
                  - img "Mountain fox notebook" [ref=e264]
                - button "Quick view Mountain fox notebook" [ref=e265] [cursor=pointer]:
                  - generic [ref=e266]: 
                  - text: Quick view
              - generic [ref=e267]:
                - generic [ref=e268]:
                  - link "View product Mountain fox notebook" [ref=e269] [cursor=pointer]:
                    - /url: http://localhost:8080/16-28-mountain-fox-notebook.html#/22-paper_type-ruled
                    - text: Mountain fox notebook
                  - generic "Price" [ref=e271]: €12.90
                - generic [ref=e273]:
                  - generic [ref=e275]:
                    - button "Decrease quantity of Mountain fox notebook" [ref=e276] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Mountain fox notebook" [ref=e277]: "1"
                    - button "Increase quantity of Mountain fox notebook" [ref=e278] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Mountain fox notebook" [ref=e279] [cursor=pointer]:
                    - generic [ref=e280]: 
        - link "All new products" [ref=e282] [cursor=pointer]:
          - /url: http://localhost:8080/new-products
          - text: All new products
          - generic [ref=e283]: 
      - generic [ref=e285]:
        - heading "Special deals" [level=2] [ref=e286]
        - generic [ref=e288]:
          - article [ref=e289]:
            - generic [ref=e290]:
              - generic [ref=e291]:
                - list:
                  - listitem: "-20%"
                  - listitem: New
                - link [ref=e293] [cursor=pointer]:
                  - /url: http://localhost:8080/2-9-brown-bear-printed-sweater.html#/1-size-s
                  - img "Brown bear printed sweater" [ref=e295]
                - button "Quick view Hummingbird printed sweater" [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: 
                  - text: Quick view
              - generic [ref=e298]:
                - generic [ref=e299]:
                  - link "View product Hummingbird printed sweater" [ref=e300] [cursor=pointer]:
                    - /url: http://localhost:8080/2-9-brown-bear-printed-sweater.html#/1-size-s
                    - text: Hummingbird printed sweater
                  - generic [ref=e301]:
                    - generic "Price" [ref=e302]: €28.72
                    - generic [ref=e303]: €35.90
                - generic [ref=e305]:
                  - generic [ref=e307]:
                    - button "Decrease quantity of Hummingbird printed sweater" [ref=e308] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Hummingbird printed sweater" [ref=e309]: "1"
                    - button "Increase quantity of Hummingbird printed sweater" [ref=e310] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Hummingbird printed sweater" [ref=e311] [cursor=pointer]:
                    - generic [ref=e312]: 
          - article [ref=e313]:
            - generic [ref=e314]:
              - generic [ref=e315]:
                - list:
                  - listitem: "-20%"
                  - listitem: New
                - link [ref=e317] [cursor=pointer]:
                  - /url: http://localhost:8080/1-1-hummingbird-printed-t-shirt.html#/1-size-s/8-color-white
                  - img "Hummingbird printed t-shirt" [ref=e319]
                - button "Quick view Hummingbird printed t-shirt" [ref=e320] [cursor=pointer]:
                  - generic [ref=e321]: 
                  - text: Quick view
              - generic [ref=e322]:
                - generic [ref=e323]:
                  - link "View product Hummingbird printed t-shirt" [ref=e324] [cursor=pointer]:
                    - /url: http://localhost:8080/1-1-hummingbird-printed-t-shirt.html#/1-size-s/8-color-white
                    - text: Hummingbird printed t-shirt
                  - generic [ref=e325]:
                    - link "White - Hummingbird printed t-shirt" [ref=e326] [cursor=pointer]:
                      - /url: http://localhost:8080/1-3-hummingbird-printed-t-shirt.html#/2-size-m/8-color-white
                    - link "Black - Hummingbird printed t-shirt" [ref=e327] [cursor=pointer]:
                      - /url: http://localhost:8080/1-2-hummingbird-printed-t-shirt.html#/1-size-s/11-color-black
                  - generic [ref=e328]:
                    - generic "Price" [ref=e329]: €19.12
                    - generic [ref=e330]: €23.90
                - generic [ref=e332]:
                  - generic [ref=e334]:
                    - button "Decrease quantity of Hummingbird printed t-shirt" [ref=e335] [cursor=pointer]:
                      - generic: 
                    - textbox "Change quantity of Hummingbird printed t-shirt" [ref=e336]: "1"
                    - button "Increase quantity of Hummingbird printed t-shirt" [ref=e337] [cursor=pointer]:
                      - generic: 
                  - button "Add to cart Hummingbird printed t-shirt" [ref=e338] [cursor=pointer]:
                    - generic [ref=e339]: 
        - link "All discounts" [ref=e341] [cursor=pointer]:
          - /url: http://localhost:8080/prices-drop
          - text: All discounts
          - generic [ref=e342]: 
  - contentinfo [ref=e343]:
    - generic [ref=e347]:
      - paragraph [ref=e348]: Get our latest news and special sales
      - generic [ref=e349]:
        - generic [ref=e350]:
          - textbox "Your email address" [ref=e351]
          - button "Subscribe to our newsletter" [ref=e352] [cursor=pointer]: Subscribe
        - paragraph [ref=e353]: You may unsubscribe at any moment. For that purpose, please find our contact info in the legal notice.
    - generic [ref=e355]:
      - generic [ref=e356]:
        - navigation [ref=e357]:
          - paragraph [ref=e358]: Products
          - list [ref=e360]:
            - listitem [ref=e361]:
              - link "Prices drop" [ref=e362] [cursor=pointer]:
                - /url: http://localhost:8080/prices-drop
              - generic [ref=e363]: Our special products
            - listitem [ref=e364]:
              - link "New products" [ref=e365] [cursor=pointer]:
                - /url: http://localhost:8080/new-products
              - generic [ref=e366]: Our new products
            - listitem [ref=e367]:
              - link "Best sellers" [ref=e368] [cursor=pointer]:
                - /url: http://localhost:8080/best-sellers
              - generic [ref=e369]: Our best sales
        - navigation [ref=e370]:
          - paragraph [ref=e371]: Our company
          - list [ref=e373]:
            - listitem [ref=e374]:
              - link "Delivery" [ref=e375] [cursor=pointer]:
                - /url: http://localhost:8080/content/1-delivery
              - generic [ref=e376]: Our terms and conditions of delivery
            - listitem [ref=e377]:
              - link "Legal Notice" [ref=e378] [cursor=pointer]:
                - /url: http://localhost:8080/content/2-legal-notice
              - generic [ref=e379]: Legal notice
            - listitem [ref=e380]:
              - link "Terms and conditions of use" [ref=e381] [cursor=pointer]:
                - /url: http://localhost:8080/content/3-terms-and-conditions-of-use
              - generic [ref=e382]: Our terms and conditions of use
            - listitem [ref=e383]:
              - link "About us" [ref=e384] [cursor=pointer]:
                - /url: http://localhost:8080/content/4-about-us
              - generic [ref=e385]: Learn more about us
            - listitem [ref=e386]:
              - link "Secure payment" [ref=e387] [cursor=pointer]:
                - /url: http://localhost:8080/content/5-secure-payment
              - generic [ref=e388]: Our secure payment method
            - listitem [ref=e389]:
              - link "Contact us" [ref=e390] [cursor=pointer]:
                - /url: http://localhost:8080/contact-us
              - generic [ref=e391]: Use our form to contact us
            - listitem [ref=e392]:
              - link "Sitemap" [ref=e393] [cursor=pointer]:
                - /url: http://localhost:8080/sitemap
              - generic [ref=e394]: Lost ? Find what your are looking for
            - listitem [ref=e395]:
              - link "Stores" [ref=e396] [cursor=pointer]:
                - /url: http://localhost:8080/stores
        - navigation [ref=e397]:
          - paragraph [ref=e398]:
            - link "Your account" [ref=e399] [cursor=pointer]:
              - /url: http://localhost:8080/my-account
          - list [ref=e401]:
            - listitem [ref=e402]:
              - link "Order tracking" [ref=e403] [cursor=pointer]:
                - /url: http://localhost:8080/guest-tracking
            - listitem [ref=e404]:
              - link "Sign in" [ref=e405] [cursor=pointer]:
                - /url: http://localhost:8080/my-account
            - listitem [ref=e406]:
              - link "Create an account" [ref=e407] [cursor=pointer]:
                - /url: http://localhost:8080/registration
        - region [ref=e408]:
          - paragraph [ref=e409]: Store information
          - generic [ref=e410]:
            - generic [ref=e411]: PrestaShopUnited Kingdom
            - generic [ref=e412]:
              - generic [ref=e413]: 
              - 'link "Send us an email to: demo@prestashop.com" [ref=e414] [cursor=pointer]':
                - /url: mailto:demo@prestashop.com
                - text: demo@prestashop.com
      - link "© 2026 - Ecommerce software by PrestaShop™" [ref=e416] [cursor=pointer]:
        - /url: https://www.prestashop-project.org/
  - link "Back to top" [ref=e417] [cursor=pointer]:
    - /url: "#back-to-top"
```

# Test source

```ts
  3   | // antithesis/scratchbook/property-catalog.md, "Session & Auth Boundaries" category, and
  4   | // antithesis/scratchbook/evaluation/synthesis.md's Refinement #1 for why these can't be Bombadil
  5   | // properties: Bombadil's `extract()` only sees `document`/`window`, and Set-Cookie is never
  6   | // exposed to page JS by any browser, by design, regardless of HttpOnly. Playwright reads responses
  7   | // through its CDP session instead, so it doesn't hit that wall — `response.headersArray()`
  8   | // explicitly preserves repeated headers like Set-Cookie (unlike `response.headers()`, which both
  9   | // drops cookie-related headers and would collapse duplicates into one string anyway).
  10  | //
  11  | // Unlike regression-bugs.spec.js, these assert the CORRECT behavior (normal test semantics: a
  12  | // failure means a real defect), not the currently-reported-buggy behavior. Two of the three are
  13  | // expected to fail on this install as of 2026-09-29 (PS 9.1.4, prestashop/prestashop:latest) —
  14  | // see the per-test comments and the linked evidence files for the confirmed root causes.
  15  | 
  16  | const { test, expect } = require('@playwright/test');
  17  | 
  18  | const SESSION_COOKIE_NAMES = ['PHPSESSID', /^PrestaShop-/];
  19  | // Real sessions should last hours or days, not years. Anything past this ceiling is either the
  20  | // confirmed expiry-math bug (see session-cookie-lifetime-bounded.md) or a config choice that
  21  | // still deserves a human's attention — either way it should fail loudly, not silently pass.
  22  | const MAX_SANE_LIFETIME_SECONDS = 60 * 60 * 24 * 400; // ~400 days
  23  | 
  24  | function isSessionCookie(name) {
  25  |   return SESSION_COOKIE_NAMES.some((pattern) =>
  26  |     pattern instanceof RegExp ? pattern.test(name) : pattern === name,
  27  |   );
  28  | }
  29  | 
  30  | // Parses one Set-Cookie header value into { name, value, attributes, raw }. `attributes` keys are
  31  | // lower-cased attribute names (e.g. "max-age", "secure"); a flag attribute like `Secure` (no `=`)
  32  | // is present as a key with an empty-string value, so `'secure' in attributes` is the right check.
  33  | function parseSetCookieHeader(raw) {
  34  |   const [pair, ...attrParts] = raw.split(';').map((s) => s.trim());
  35  |   const eq = pair.indexOf('=');
  36  |   const name = pair.slice(0, eq);
  37  |   const value = pair.slice(eq + 1);
  38  |   const attributes = {};
  39  |   for (const part of attrParts) {
  40  |     const [attrName, ...rest] = part.split('=');
  41  |     attributes[attrName.trim().toLowerCase()] = rest.join('=').trim();
  42  |   }
  43  |   return { name, value, attributes, raw };
  44  | }
  45  | 
  46  | async function getSetCookieHeaders(response) {
  47  |   return (await response.headersArray()).filter((h) => h.name.toLowerCase() === 'set-cookie');
  48  | }
  49  | 
  50  | test.describe('Session cookie properties (antithesis-research property catalog)', () => {
  51  |   // antithesis/scratchbook/properties/session-cookie-lifetime-bounded.md
  52  |   // Expected to FAIL on this install: config/config.inc.php builds the session cookie's expiry as
  53  |   // an absolute future Unix timestamp (correct for Cookie::__construct()'s $expire param), then
  54  |   // reuses that same value unconverted as SessionHandler's $lifetime constructor arg, which PHP's
  55  |   // session_set_cookie_params() treats as a *relative* seconds-from-now duration — landing the
  56  |   // real expiry around double "now", i.e. decades out (observed: 18 July 2083).
  57  |   test('session-cookie-lifetime-bounded: no session cookie has an implausibly long lifetime', async ({ page }) => {
  58  |     const response = await page.goto('/');
  59  |     const cookies = (await getSetCookieHeaders(response))
  60  |       .map((h) => parseSetCookieHeader(h.value))
  61  |       .filter((c) => isSessionCookie(c.name));
  62  | 
  63  |     expect(cookies.length, 'expected at least one session cookie to be set on the homepage response').toBeGreaterThan(0);
  64  | 
  65  |     for (const cookie of cookies) {
  66  |       const maxAge = cookie.attributes['max-age'] !== undefined ? parseInt(cookie.attributes['max-age'], 10) : null;
  67  |       const expires = cookie.attributes['expires'] ? new Date(cookie.attributes['expires']) : null;
  68  |       const lifetimeSeconds = maxAge ?? (expires ? (expires.getTime() - Date.now()) / 1000 : null);
  69  | 
  70  |       expect(lifetimeSeconds, `${cookie.name} has neither a Max-Age nor an Expires attribute`).not.toBeNull();
  71  |       expect(
  72  |         lifetimeSeconds,
  73  |         `${cookie.name}'s lifetime is ~${Math.round(lifetimeSeconds / 86400)} days ` +
  74  |           `(raw: "${cookie.raw}"), expected under ${MAX_SANE_LIFETIME_SECONDS / 86400} days. ` +
  75  |           `See antithesis/scratchbook/properties/session-cookie-lifetime-bounded.md.`,
  76  |       ).toBeLessThan(MAX_SANE_LIFETIME_SECONDS);
  77  |     }
  78  |   });
  79  | 
  80  |   // antithesis/scratchbook/properties/duplicate-session-cookie-single-write.md
  81  |   // Expected to FAIL on this install: the homepage response sets the PrestaShop-<hash> cookie
  82  |   // twice with two different encrypted values in a single response (confirmed via curl — see the
  83  |   // evidence file's Investigation Log). Relies on unspecified "last Set-Cookie wins" client
  84  |   // behavior instead of writing the cookie once.
  85  |   test('duplicate-session-cookie-single-write: no response sets the same cookie twice with different values', async ({ page }) => {
  86  |     const response = await page.goto('/');
  87  |     const setCookies = await getSetCookieHeaders(response);
  88  | 
  89  |     const distinctValuesByName = new Map();
  90  |     for (const { value } of setCookies) {
  91  |       const { name, raw } = parseSetCookieHeader(value);
  92  |       if (!distinctValuesByName.has(name)) distinctValuesByName.set(name, new Set());
  93  |       distinctValuesByName.get(name).add(raw);
  94  |     }
  95  | 
  96  |     expect(distinctValuesByName.size, 'expected at least one Set-Cookie header on the homepage response').toBeGreaterThan(0);
  97  | 
  98  |     for (const [name, distinctValues] of distinctValuesByName) {
  99  |       expect(
  100 |         distinctValues.size,
  101 |         `${name} was set ${distinctValues.size} times with different values in one response:\n` +
  102 |           [...distinctValues].join('\n'),
> 103 |       ).toBe(1);
      |         ^ Error: PrestaShop-86fce55cad942ed59f2bbba85dc3f9a1 was set 2 times with different values in one response:
  104 |     }
  105 |   });
  106 | 
  107 |   // antithesis/scratchbook/properties/session-cookie-secure-flag-matches-transport.md
  108 |   // Expected to PASS on this install: confirms the (correct, if not ideal — this deployment simply
  109 |   // never serves HTTPS on the storefront/admin port, see bugs.md #6) absence of a Secure flag over
  110 |   // plain HTTP, as a regression guard against e.g. a future reverse-proxy header-trust bug.
  111 |   test('session-cookie-secure-flag-matches-transport: no cookie claims Secure over plain HTTP', async ({ page }) => {
  112 |     const response = await page.goto('/');
  113 |     expect(new URL(response.url()).protocol, 'this property only makes sense over plain HTTP').toBe('http:');
  114 | 
  115 |     const setCookies = await getSetCookieHeaders(response);
  116 |     expect(setCookies.length, 'expected at least one Set-Cookie header on the homepage response').toBeGreaterThan(0);
  117 | 
  118 |     for (const { value } of setCookies) {
  119 |       const { name, attributes } = parseSetCookieHeader(value);
  120 |       expect('secure' in attributes, `${name} was issued with the Secure attribute over plain HTTP`).toBe(false);
  121 |     }
  122 |   });
  123 | });
  124 | 
```