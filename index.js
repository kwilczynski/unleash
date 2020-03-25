'use strict';


const unleash = require('unleash-server');
const passport = require('passport');
const GithubStrategy = require('./lib/strategy.js');

const GH_CLIENT_ID = process.env.GH_CLIENT_ID;
const GH_CLIENT_SECRET = process.env.GH_CLIENT_SECRET;
const GH_CALLBACK_URL = process.env.GH_CALLBACK_URL;
const ADMIN_ACCESS_TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const CLIENT_ACCESS_TOKEN = process.env.CLIENT_ACCESS_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ORGS = process.env.ORGS;

if(!GH_CLIENT_ID) {
    throw new Error('GH_CLIENT_ID not set!');
}
if(!GH_CLIENT_SECRET) {
    throw new Error('GH_CLIENT_SECRET not set!');
}
if(!GH_CALLBACK_URL) {
    throw new Error('GH_CALLBACK_URL not set!');
}
if(!ADMIN_ACCESS_TOKEN) {
    throw new Error('ADMIN_ACCESS_TOKEN not set!');
}
if(!CLIENT_ACCESS_TOKEN) {
    throw new Error('CLIENT_ACCESS_TOKEN not set!');
}
if(!SESSION_SECRET) {
    throw new Error('SESSION_SECRET not set!');
}
if(!ORGS) {
    throw new Error('ORGS not set!');
}

passport.use(
  new GithubStrategy(
    {
      clientID: GH_CLIENT_ID,
      clientSecret: GH_CLIENT_SECRET,
      callbackURL: GH_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, cb) => {

      var inOrg = false;
      var orgs = ORGS.split(',')

      for (var index in orgs) {

        if (profile.orgs.includes(orgs[index])) {
          inOrg = true;
          break;
          }
        }

      if (!inOrg) {
        cb(
          null,
          false,
          );
      } else {
        cb(
          null,
          new unleash.User({
            name: profile.displayName,
            email: profile.emails[0].value,
            }),
          );
        }
    },
  ),
);

function adminAuth(app) {
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  app.get(
    '/api/admin/login',
    passport.authenticate('github', { scope: [ 'user:email,read:org' ] }),
  );
  app.get(
    '/api/auth/callback',
    passport.authenticate('github', { failureRedirect: '/api/admin/error-login'}),
    function(req, res) {
        res.redirect('/');
    }
  );

  app.use('/api/admin/', (req, res, next) => {
    if (req.user) {
      next();
    } else if (req.header('authorization') === `Bearer ${ADMIN_ACCESS_TOKEN}`) {
      next();
    } else {
      return res
        .status('401')
        .json(
          new unleash.AuthenticationRequired({
            path: '/api/admin/login',
            type: 'custom',
            message: `You have to be a member of one of these orgs: ${ORGS.replace(',', ', ')}`,
          }),
        )
        .end();
    }
  });

  app.use('/api/client', (req, res, next) => {
    if (req.header('authorization') === `Bearer ${CLIENT_ACCESS_TOKEN}`) {
      next();
     } else {
       res.sendStatus(401);
     }
   });
}

const options = {
  enableLegacyRoutes: false,
  secret: SESSION_SECRET,
  adminAuthentication: 'custom',
  preRouterHook: adminAuth,
};

unleash.start(options).then(instance => {
  console.log(
    `Unleash started on http://localhost:${instance.app.get('port')}`,
  );
});